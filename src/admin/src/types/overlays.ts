/** Every flow the one overlay host can open (`OverlayHost`). Opening a flow replaces the open one. Each is a modal work
 *  window drawn inside the main window: Settings, the Preview of one saved channel (`36` section 8), and the previews of
 *  one provider and of one title (`55` decisions 7 and 8). */
export type OverlayId = "settings" | "preview" | "provider-preview" | "title-preview";