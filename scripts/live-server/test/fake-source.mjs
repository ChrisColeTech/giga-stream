/** Fixtures for the live server tests: a fake loop source and fake playlists (no ffmpeg, no disk). */

export const FAKE_MASTER = [
  "#EXTM3U",
  '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="audio",LANGUAGE="en",DEFAULT=YES,URI="audio/index.m3u8"',
  '#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360,AUDIO="aud"',
  "360p/index.m3u8",
  '#EXT-X-STREAM-INF:BANDWIDTH=2600000,RESOLUTION=1280x720,AUDIO="aud"',
  "720p/index.m3u8",
  "",
].join("\n");

/** A source of `count` two-second segments per rendition; segment bytes are "<rendition>:<index>". */
export function fakeSource(count = 5) {
  const renditions = new Map();
  for (const id of ["360p", "720p", "audio"]) {
    const segments = Array.from({ length: count }, (_, index) => ({
      uri: `seg${String(index).padStart(3, "0")}.ts`,
      duration: 2,
    }));
    renditions.set(id, { uri: `${id}/index.m3u8`, segments });
  }
  return {
    masterText: FAKE_MASTER,
    renditions,
    async readSegment(id, index) {
      return renditions.get(id)?.segments[index] ? Buffer.from(`${id}:${index}`) : null;
    },
  };
}

/** A three-segment media playlist starting at `sequence`, in the shape both modes serve. */
export function samplePlaylist(sequence) {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3", "#EXT-X-TARGETDURATION:2", `#EXT-X-MEDIA-SEQUENCE:${sequence}`];
  for (let offset = 0; offset < 3; offset += 1) {
    const number = sequence + offset;
    const at = new Date(Date.UTC(2026, 9, 15, 12, 0, 0) + number * 2000).toISOString();
    lines.push(`#EXT-X-PROGRAM-DATE-TIME:${at}`, "#EXTINF:2.000,", `seg${String(number).padStart(5, "0")}.ts`);
  }
  return `${lines.join("\n")}\n`;
}
