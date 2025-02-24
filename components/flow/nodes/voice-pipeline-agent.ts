import { Node } from "@xyflow/react";

export default [
  {
    id: "voice_pipeline_agent_group",
    type: "groupNode",
    position: { x: 1420, y: 810 },
    style: {
      width: 300,
      height: 90,
      backgroundColor: "rgba(255, 243, 230, 0.3)",
      borderRadius: "8px",
      border: "1px solid #ffb74d",
    },
    data: { label: "VoicePipelineAgent" },
  },
  {
    id: "agent_instance",
    position: { x: 10, y: 40 },
    data: { label: "agent" },
    parentId: "voice_pipeline_agent_group",
  },
] as Node[];
