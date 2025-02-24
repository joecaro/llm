import { Node } from "@xyflow/react";

export default [
  {
    id: "app_config_group",
    type: "groupNode",
    position: { x: -300, y: 150 },
    style: {
      width: 490,
      height: 120,
      backgroundColor: "rgba(255, 230, 255, 0.5)",
      borderRadius: "8px",
      border: "1px solid #ce93d8",
    },
    data: { label: "app_config.py" },
  },
  {
    id: "reinitialize_app_config",
    position: { x: 170, y: 70 },
    data: { label: "reinitialize" },
    parentId: "app_config_group",
  },
  {
    id: "set_thread_id_app_config",
    position: { x: 10, y: 70 },
    data: { label: "set_thread_id" },
    parentId: "app_config_group",
  },
  {
    id: "set_call_metadata_app_config",
    position: { x: 330, y: 70 },
    data: { label: "set_call_metadata" },
    parentId: "app_config_group",
  },
] as Node[];
