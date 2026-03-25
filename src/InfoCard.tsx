import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/NotoSansTC";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});

export const InfoCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

  const scale = interpolate(entrance, [0, 1], [0.8, 1]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  const items = [
    { icon: "🕐", zh: "航行時間 約50分鐘", en: "Duration: ~50 min" },
    { icon: "💰", zh: "成人 ¥2,000", en: "Adult ¥2,000" },
    { icon: "👶", zh: "兒童 ¥1,000", en: "Child ¥1,000" },
  ];

  return (
    <div
      style={{
        position: "absolute",
        bottom: 380,
        left: 40,
        right: 40,
        opacity,
        transform: `scale(${scale})`,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {items.map((item, i) => {
        const itemEntrance = spring({
          frame,
          fps,
          delay: i * 6,
          config: { damping: 200 },
        });
        const itemOpacity = interpolate(itemEntrance, [0, 1], [0, 1]);
        const itemX = interpolate(itemEntrance, [0, 1], [40, 0]);

        return (
          <div
            key={i}
            style={{
              background: "rgba(0, 0, 0, 0.7)",
              borderRadius: 16,
              padding: "20px 28px",
              backdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center",
              gap: 16,
              opacity: itemOpacity,
              transform: `translateX(${itemX}px)`,
            }}
          >
            <span style={{ fontSize: 40 }}>{item.icon}</span>
            <div>
              <div
                style={{
                  fontFamily,
                  fontSize: 38,
                  fontWeight: 700,
                  color: "white",
                }}
              >
                {item.zh}
              </div>
              <div
                style={{
                  fontFamily,
                  fontSize: 24,
                  color: "rgba(255,255,255,0.8)",
                }}
              >
                {item.en}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
