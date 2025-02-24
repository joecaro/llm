export default [
  {
    id: "graph_manager_group",
    type: "groupNode",
    position: { x: 1420, y: 400 },
    style: {
      width: 300,
      height: 300,
      backgroundColor: "rgba(230, 255, 230, 0.3)",
      borderRadius: "8px",
      border: "1px solid #81c784",
    },
    data: { label: "GraphManager" },
  },
  {
    id: "reinitialize_graph",
    position: { x: 10, y: 40 },
    data: { label: "reinitialize_graph" },
    parentId: "graph_manager_group",
  },
  {
    id: "initialize_memory",
    position: { x: 120, y: 110 },
    data: { label: "MemoryManager.reinitialize()" },
    parentId: "graph_manager_group",
  },
  {
    id: "configure_langgraph",
    position: { x: 120, y: 170 },
    data: { label: "initialize_graph" },
    parentId: "graph_manager_group",
  },
  {
    id: "get_client_config",
    position: { x: 120, y: 230 },
    data: { label: "get client config" },
    parentId: "graph_manager_group",
  },
];
