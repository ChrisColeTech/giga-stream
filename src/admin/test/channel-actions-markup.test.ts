import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChannelActions } from "@/components/channels/ChannelActions";
import { ChannelRows } from "@/components/channels/ChannelRows";
import { UNREACHABLE_REASON } from "@/constants/channel-copy";
import { usePreviewOpen } from "@/hooks/usePreviewOpen";
import { channelRow } from "@/lib/channel-rows";
import { useAppStore } from "@/store/app-store";
import { holdChannels } from "./support/channels-hold";
import { live, stream } from "./support/channels-kit";
import { renderLive, resetStore, signInForTest } from "./support/store";

/* The end cell of a Channels row (owner, 2026-10-18): the eye `Preview` beside the armed `Delete`, at the table's right
 * edge. It opens the same preview as the page toolbar's `Preview →`, for the row's own channel, live or stream. */
const state = () => useAppStore.getState();
const count = (html: string, needle: string): number => html.split(needle).length - 1;

function clicks(node: ReactNode, label: string): Array<() => void> {
  if (!isValidElement(node)) return Array.isArray(node) ? node.flatMap((one) => clicks(one, label)) : [];
  const element: ReactElement<{ children?: ReactNode; onClick?: () => void; "aria-label"?: string }> = node as never;
  const own = element.props["aria-label"] === label && element.props.onClick !== undefined ? [element.props.onClick] : [];
  return [...own, ...clicks(element.props.children, label)];
}

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("a channel row's end cell", () => {
  it("holds a Preview icon button with its tooltip and label, left of the armed Delete, on live and stream rows", () => {
    holdChannels([live("a"), stream("b")], 1);
    const html = renderLive(createElement(ChannelRows));
    assert.equal(count(html, 'aria-label="Preview channel"'), 2);
    assert.equal(count(html, 'title="Preview channel"'), 2);
    assert.equal(count(html, "lucide-eye"), 2);
    const first = html.slice(html.indexOf("<li"), html.indexOf("</li>"));
    assert.ok(first.indexOf('aria-label="Preview channel"') < first.indexOf(">Delete</button>"));
  });

  it("is disabled with the reason as its tooltip while the backend cannot be reached", () => {
    holdChannels([live("a")], 1);
    state().channelsMarkUnreachable(true);
    const html = renderLive(createElement(ChannelRows));
    assert.ok(html.includes(`Preview channel. ${UNREACHABLE_REASON}`));
    assert.ok(!html.includes('title="Preview channel"'));
  });

  it("calls the shared preview entry with the row's id when pressed", () => {
    const seen: string[] = [];
    const row = channelRow(live("a"));
    const cell = ChannelActions({ row, deleteReason: undefined, previewReason: undefined, onPreview: (id) => seen.push(id), onDelete: () => undefined });
    const press = clicks(cell, "Preview channel");
    assert.equal(press.length, 1);
    press[0]?.();
    assert.deepEqual(seen, [row.id]);
  });

  it("opens the Preview window on that channel through the same entry as the toolbar", () => {
    let open: (id: string) => void = () => undefined;
    renderToStaticMarkup(createElement(() => {
      open = usePreviewOpen();
      return null;
    }));
    open("b");
    assert.equal(state().channels.preview?.channelId, "b");
    assert.equal(state().overlay, "preview");
  });
});
