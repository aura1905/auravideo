/**
 * Desktop plumbing self-test.
 *
 * The filter graph can be checked from a shell, but the JS↔Rust layer (command
 * names, argument casing, event payload shape, fs permissions, working
 * directory) can only be exercised inside the real app. This runs the whole
 * native export path end-to-end on a generated clip and writes the outcome to
 * `<temp>/nabivideo/selftest.json`, so a build can be verified without driving
 * the GUI.
 *
 * Gated behind `VITE_SELFTEST=1` at build time — it is never in a normal build.
 */
import {
  ffmpegInfo,
  ffmpegRun,
  fileSize,
  isNative,
  removeTempFile,
  tempRoot,
  writeTempFile,
} from './native';

type Step = { name: string; ok: boolean; detail: string };

export async function runSelfTest(): Promise<void> {
  const steps: Step[] = [];
  const record = async (name: string, fn: () => Promise<string>) => {
    try {
      steps.push({ name, ok: true, detail: await fn() });
    } catch (e: any) {
      steps.push({ name, ok: false, detail: e?.message ?? String(e) });
    }
  };

  let scratch = '';
  let encoder = 'libx264';

  await record('isNative', async () => String(isNative()));
  await record('ffmpeg_info', async () => {
    const info = await ffmpegInfo();
    if (info.encoders.includes('h264_nvenc')) encoder = 'h264_nvenc';
    return `${info.version} | hw=${info.encoders.join(',') || 'none'}`;
  });
  await record('temp_root', async () => (scratch = await tempRoot()));
  await record('write_temp_file(fs plugin)', async () => {
    const p = await writeTempFile('selftest-probe.bin', new Uint8Array([1, 2, 3, 4]));
    const n = await fileSize(p);
    if (n !== 4) throw new Error(`expected 4 bytes, got ${n}`);
    await removeTempFile(p);
    return `${p} (4 bytes, removed)`;
  });

  // A real render through the same command the export uses: generated source,
  // a filter_complex, the chosen encoder, output written by absolute path
  // while the process runs from the scratch dir.
  let logLines = 0;
  const sep = scratch.includes('\\') ? '\\' : '/';
  const outPath = `${scratch}${sep}selftest-out.mp4`;
  await record(`ffmpeg_run(${encoder})`, async () => {
    const args = [
      '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=30:duration=2',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
      '-filter_complex',
      '[0:v]trim=start=0:end=2,setpts=PTS-STARTPTS,scale=640:360[v];' +
        '[1:a]atrim=start=0:end=2,asetpts=PTS-STARTPTS,volume=1.0[a]',
      '-map', '[v]', '-map', '[a]',
      ...(encoder === 'h264_nvenc'
        ? ['-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', '21', '-b:v', '0']
        : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20']),
      '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k',
      '-t', '2', '-y', outPath,
    ];
    const ret = await ffmpegRun('selftest', args, scratch, () => {
      logLines++;
    });
    if (ret !== 0) throw new Error(`exit code ${ret}`);
    return `ret=0, ${logLines} log lines streamed`;
  });
  await record('output size', async () => {
    const n = await fileSize(outPath);
    if (!n) throw new Error('output is empty');
    return `${n} bytes`;
  });

  const summary = {
    when: new Date().toISOString(),
    allOk: steps.every((s) => s.ok),
    steps,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(summary, null, 2));
  try {
    await writeTempFile('selftest.json', bytes);
  } catch (e) {
    console.error('[selftest] could not write result', e);
  }
  console.log('[selftest]', summary);
}
