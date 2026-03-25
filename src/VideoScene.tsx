import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import { staticFile } from "remotion";
import { TextOverlay } from "./TextOverlay";

type VideoSceneProps = {
  src: string;
  textZh: string;
  textEn: string;
  textPosition?: "bottom" | "center" | "top";
  textStyle?: "default" | "highlight" | "info";
  trimStart?: number;
  trimEnd?: number;
  playbackRate?: number;
};

export const VideoScene: React.FC<VideoSceneProps> = ({
  src,
  textZh,
  textEn,
  textPosition = "bottom",
  textStyle = "default",
  trimStart,
  trimEnd,
  playbackRate = 1,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Video
        src={staticFile(src)}
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
        trimBefore={trimStart != null ? trimStart * fps : undefined}
        trimAfter={trimEnd != null ? trimEnd * fps : undefined}
        playbackRate={playbackRate}
      />
      <Sequence from={Math.round(0.3 * fps)} premountFor={fps}>
        <TextOverlay
          textZh={textZh}
          textEn={textEn}
          position={textPosition}
          style={textStyle}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
