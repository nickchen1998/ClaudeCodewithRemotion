import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/NotoSansTC";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});

type TextOverlayProps = {
  textZh: string;
  textEn: string;
  position?: "bottom" | "center" | "top";
  style?: "default" | "highlight" | "info";
};

export const TextOverlay: React.FC<TextOverlayProps> = ({
  textZh,
  textEn,
  position = "bottom",
  style = "default",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

  const translateY = interpolate(entrance, [0, 1], [30, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  const positionStyle: React.CSSProperties =
    position === "top"
      ? { top: 180 }
      : position === "center"
        ? { top: "50%", transform: `translateY(-50%) translateY(${translateY}px)` }
        : { bottom: 420 };

  const bgColor =
    style === "highlight"
      ? "rgba(0, 0, 0, 0.75)"
      : style === "info"
        ? "rgba(0, 0, 0, 0.7)"
        : "rgba(0, 0, 0, 0.6)";

  return (
    <div
      style={{
        position: "absolute",
        left: 40,
        right: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity,
        transform: position !== "center" ? `translateY(${translateY}px)` : undefined,
        ...positionStyle,
      }}
    >
      <div
        style={{
          background: bgColor,
          borderRadius: 16,
          padding: "24px 36px",
          backdropFilter: "blur(10px)",
        }}
      >
        <div
          style={{
            fontFamily,
            fontSize: 58,
            fontWeight: 700,
            color: "white",
            textAlign: "center",
            lineHeight: 1.4,
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {textZh}
        </div>
        <div
          style={{
            fontFamily,
            fontSize: 38,
            fontWeight: 400,
            color: "rgba(255,255,255,0.85)",
            textAlign: "center",
            marginTop: 8,
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {textEn}
        </div>
      </div>
    </div>
  );
};
