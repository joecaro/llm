import { Node } from "@xyflow/react";

export default [
  {
    id: "run_voice_pipeline_agent",
    type: "groupNode",
    position: { x: 420, y: 30 },
    style: {
      width: 170,
      height: 240,
      backgroundColor: "rgba(255, 230, 255, 0.3)",
      borderRadius: "8px",
      border: "1px solid #ce93d8",
    },
    data: { label: "run_voice_pipeline_agent" },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "initialize_pipeline",
    position: { x: 10, y: 40 },
    data: { label: "initialize_pipeline" },
    parentId: "run_voice_pipeline_agent",
  },
  {
    id: "graph_manager_init",
    position: { x: 10, y: 90 },
    type: "fourHandleNode",
    data: { label: "GraphManager" },
    parentId: "run_voice_pipeline_agent",
  },
  {
    id: "langgraph_config",
    position: { x: 10, y: 140 },
    type: "fourHandleNode",
    data: { label: "Langgraph" },
    parentId: "run_voice_pipeline_agent",
  },
  {
    id: "voice_pipeline_agent",
    position: { x: 10, y: 190 },
    type: "fourHandleNode",
    data: { label: "VoicePipelineAgent" },
    parentId: "run_voice_pipeline_agent",
  },
] as Node[];
