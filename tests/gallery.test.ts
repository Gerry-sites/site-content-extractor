import { describe, expect, it } from "vitest";
import { captionsNeedMerge, mergeGalleryCaptions } from "../src/pack/gallery.js";
import { extractWixGalleryItems, matchWixGalleryItem } from "../src/extractors/wix/gallery-data.js";

describe("gallery captions", () => {
  it("merges pack titles and captions onto an existing string gallery", () => {
    expect(
      mergeGalleryCaptions(
        ["/images/portfolio/flood-1.jpg", "/images/portfolio/flood-2.jpg"],
        [
          {
            src: "/images/portfolio/flood-1.jpg",
            title: "After The Flood sketch",
            caption: "Pencil on paper.",
          },
        ],
      ),
    ).toEqual([
      {
        src: "/images/portfolio/flood-1.jpg",
        title: "After The Flood sketch",
        caption: "Pencil on paper.",
      },
      "/images/portfolio/flood-2.jpg",
    ]);
  });

  it("reports when existing gallery strings are missing pack captions", () => {
    expect(
      captionsNeedMerge(
        ["/images/portfolio/flood-1.jpg"],
        [{ src: "/images/portfolio/flood-1.jpg", caption: "Oil on canvas." }],
      ),
    ).toBe(true);
    expect(
      captionsNeedMerge(
        [{ src: "/images/portfolio/flood-1.jpg", caption: "Oil on canvas." }],
        [{ src: "/images/portfolio/flood-1.jpg", caption: "Oil on canvas." }],
      ),
    ).toBe(false);
  });

  it("does not treat an empty pack gallery as a caption update", () => {
    expect(
      captionsNeedMerge(["/images/portfolio/flood-1.jpg"], ["/images/portfolio/flood-1.jpg"]),
    ).toBe(false);
  });
});

describe("Wix warmup gallery metadata", () => {
  it("finds gallery items even when the key is not named _galleryData", () => {
    const html = `<script id="wix-warmup-data" type="application/json">${JSON.stringify({
      pages: {
        appsWarmupData: {
          tpa: {
            "comp-nested": {
              proGallery: {
                items: [
                  {
                    mediaUrl: "bfe860_nested~mv2.jpg",
                    metaData: {
                      title: "Nested work",
                      description: "Bronze, 40 cm.",
                    },
                  },
                ],
              },
            },
          },
        },
      },
    })}</script>`;
    expect(extractWixGalleryItems(html)).toEqual([
      {
        mediaUrl: "bfe860_nested~mv2.jpg",
        title: "Nested work",
        description: "Bronze, 40 cm.",
      },
    ]);
  });

  it("matches a media file when the page URL encodes the tilde", () => {
    const items = [
      {
        mediaUrl: "bfe860_cc280acbdadf439b85e9d4d898cf244e~mv2.jpg",
        title: "After The Flood",
        description: "Oil on canvas.",
      },
    ];
    const encoded =
      "https://static.wixstatic.com/media/bfe860_cc280acbdadf439b85e9d4d898cf244e%7Emv2.jpg/v1/fit/w_1800/a.jpg";
    expect(matchWixGalleryItem(encoded, items)?.title).toBe("After The Flood");
  });
});

describe("gallery captions", () => {
  it("merges pack titles and captions onto an existing string gallery", () => {
    expect(
      mergeGalleryCaptions(
        ["/images/portfolio/flood-1.jpg", "/images/portfolio/flood-2.jpg"],
        [
          {
            src: "/images/portfolio/flood-1.jpg",
            title: "After The Flood sketch",
            caption: "Pencil on paper.",
          },
        ],
      ),
    ).toEqual([
      {
        src: "/images/portfolio/flood-1.jpg",
        title: "After The Flood sketch",
        caption: "Pencil on paper.",
      },
      "/images/portfolio/flood-2.jpg",
    ]);
  });

  it("reports when existing gallery strings are missing pack captions", () => {
    expect(
      captionsNeedMerge(
        ["/images/portfolio/flood-1.jpg"],
        [{ src: "/images/portfolio/flood-1.jpg", caption: "Oil on canvas." }],
      ),
    ).toBe(true);
    expect(
      captionsNeedMerge(
        [{ src: "/images/portfolio/flood-1.jpg", caption: "Oil on canvas." }],
        [{ src: "/images/portfolio/flood-1.jpg", caption: "Oil on canvas." }],
      ),
    ).toBe(false);
  });

  it("does not treat an empty pack gallery as a caption update", () => {
    expect(
      captionsNeedMerge(["/images/portfolio/flood-1.jpg"], ["/images/portfolio/flood-1.jpg"]),
    ).toBe(false);
  });
});
