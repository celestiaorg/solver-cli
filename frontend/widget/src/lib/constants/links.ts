export const links = {
  explorer: "https://explorer.hyperlane.xyz",
  docs: "https://docs.hyperlane.xyz",
  warpDocs:
    "https://docs.hyperlane.xyz/docs/reference/applications/warp-routes",
  gasDocs: "https://docs.hyperlane.xyz/docs/reference/hooks/interchain-gas",
  chains: "https://docs.hyperlane.xyz/docs/resources/domains",
  imgPath: "https://cdn.jsdelivr.net/gh/hyperlane-xyz/hyperlane-registry@main",
};

export const getExplorerLink = (msgId: string) =>
  `${links.explorer}/message/${msgId}`;
