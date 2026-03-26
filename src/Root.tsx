import { Composition } from "remotion";
import { MeijiShrine } from "./compositions/MeijiShrine";
import { NangangWorkWay } from "./compositions/NangangWorkWay";

const FPS = 30;

/**
 * Remotion 入口
 *
 * 每次使用 AI pipeline 產生新的 composition 後，在此 import 並註冊。
 *
 * 範例：
 * import { MyVideo } from "./compositions/MyVideo";
 *
 * <Composition
 *   id="MyVideo"
 *   component={MyVideo}
 *   durationInFrames={900}
 *   fps={FPS}
 *   width={1080}
 *   height={1920}
 * />
 */
export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="MeijiShrine"
        component={MeijiShrine}
        durationInFrames={60 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="NangangWorkWay"
        component={NangangWorkWay}
        durationInFrames={594}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
