import { Node } from "@xyflow/react";

export default [
  {
    id: "LiveKitOutboundCall_class",
    type: "groupNode",
    position: { x: 10, y: 30 },
    style: {
      width: 380,
      height: 750,
      backgroundColor: "rgba(255, 255, 255, 0.3)",
      borderRadius: "8px",
      border: "1px solid #ccc",
    },
    data: { label: "LiveKitOutboundCall" },
    parentId: "livekit_outbound_call_group",
  },
  {
    id: "entrypoint",
    position: { x: 210, y: 10 },
    data: { label: "entrypoint (on )" },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "setup_call_metadata",
    position: { x: 210, y: 60 },
    data: { label: "get_call_metadata (redis)" },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "get_post_call_processor",
    position: { x: 210, y: 110 },
    data: { label: "get_post_call_processor" },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "get_call_metadata",
    position: { x: 210, y: 160 },
    data: { label: "get_call_metadata" },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "create_sip_participant",
    position: { x: 210, y: 210 },
    data: { label: "create_sip_participant" },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "run_voice_pipeline_agent_call",
    position: { x: 210, y: 260 },
    data: { label: "run_voice_pipeline_a..." },
    style: {
      backgroundColor: "rgba(255, 230, 255, 0.3)",
      borderRadius: "8px",
      border: "1px solid #ce93d8",
    },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "LiveKitCallStatusManager",
    position: { x: 220, y: 470 },
    data: { label: "LiveKitCallStatusManager" },
    style: {
      backgroundColor: "rgba(255, 230, 255, 0.3)",
      borderRadius: "8px",
      border: "1px solid #ce93d8",
    },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "start_outbound_call",
    position: { x: 10, y: 50 },
    data: { label: "start" },
    parentId: "LiveKitOutboundCall_class",
  },
  {
    id: "call_config",
    position: { x: 10, y: 100 },
    data: { label: "CallConfig -> save_config (redis)" },
    parentId: "LiveKitOutboundCall_class",
  },
] as Node[];
