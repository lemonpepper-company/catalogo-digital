import { ImageResponse } from "next/og";

export const size = { width: 48, height: 48 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 48,
          height: 48,
          background: "#0D0D0D",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Dot (bolinha gold) */}
        <div
          style={{
            width: 12,
            height: 12,
            background: "#C9A96E",
            borderRadius: "50%",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
