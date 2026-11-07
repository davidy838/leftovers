import type { MetadataRoute } from "next";

// Lets students "Add to Home Screen" so Leftovers opens like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Leftovers: free food on campus",
    short_name: "Leftovers",
    description: "Surplus food from campus events, shared with hungry students before it goes in the bin.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf8f3",
    theme_color: "#d9480f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}
