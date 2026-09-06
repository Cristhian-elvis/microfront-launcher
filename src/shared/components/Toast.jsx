import React from "react";
import { Icon } from "./Icon.jsx";

export function Toast({ notice }) {
  if (!notice) return null;

  return (
    <div className={`toast ${notice.kind}`}>
      <Icon name={notice.kind === "error" ? "alert" : "check"} />
      {notice.message}
    </div>
  );
}
