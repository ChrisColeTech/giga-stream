import type { ChannelList } from "@/types/channel";

/** PHASE 1 FIXTURE: the channel list the Live surface draws until phase 2 reads it from the fileserver. The four test
 *  channels are the ones `10` section 3.2 seeds; the others are invented names. No stream address is set. */
export const CHANNEL_LIST: ChannelList = {
  revision: 1,
  categories: [
    { value: "News", count: 4 },
    { value: "Sports", count: 4 },
    { value: "Music", count: 4 },
    { value: "Kids", count: 4 },
  ],
  items: [
    { id: "fx-news", name: "Fixture News", category: "News", number: "1", revision: 1, streamUrl: "" },
    { id: "fx-sports", name: "Fixture Sports", category: "Sports", number: "2", revision: 1, streamUrl: "" },
    { id: "fx-music", name: "Fixture Music", category: "Music", number: "3", revision: 1, streamUrl: "" },
    { id: "fx-kids", name: "Fixture Kids", category: "Kids", number: "4", revision: 1, streamUrl: "" },
    { id: "ch-metro", name: "Metro Desk", category: "News", number: "5", revision: 1, streamUrl: "" },
    { id: "ch-rally", name: "Rally Live", category: "Sports", number: "6", revision: 1, streamUrl: "" },
    { id: "ch-vinyl", name: "Vinyl Hour", category: "Music", number: "7", revision: 1, streamUrl: "" },
    { id: "ch-cartoon", name: "Cartoon Bay", category: "Kids", number: "8", revision: 1, streamUrl: "" },
    { id: "ch-harbour", name: "Harbour News", category: "News", number: "9", revision: 1, streamUrl: "" },
    { id: "ch-pitch", name: "Pitch One", category: "Sports", number: "10", revision: 1, streamUrl: "" },
    { id: "ch-studio", name: "Studio Rock", category: "Music", number: "11", revision: 1, streamUrl: "" },
    { id: "ch-story", name: "Story Time", category: "Kids", number: "12", revision: 1, streamUrl: "" },
    { id: "ch-night", name: "Night Desk", category: "News", number: "13", revision: 1, streamUrl: "" },
    { id: "ch-court", name: "Court Side", category: "Sports", number: "14", revision: 1, streamUrl: "" },
    { id: "ch-jazz", name: "Jazz Room", category: "Music", number: "15", revision: 1, streamUrl: "" },
    { id: "ch-robots", name: "Tiny Robots", category: "Kids", number: "16", revision: 1, streamUrl: "" },
  ],
};

/** PHASE 1 FIXTURE: the state answer's `lastChannelId` (`03` section 4): the channel Live opens on when the Live opens
 *  setting is "Last channel". */
export const LAST_CHANNEL_ID = "fx-music";
