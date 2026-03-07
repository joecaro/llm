"use client";
import React, { useCallback, useState } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "../ui/button";
import initialNodes from "./nodes";
import initialEdges from "./edges";
import GroupNode from "./group-node";
import { groupNodesByParent } from "./nodes/utils";
import FourHandleNode from "./four-handle-node";

const getId = () => Math.random().toString(36).substring(2, 15);

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  const customNodeTypes = {
    groupNode: GroupNode,
    fourHandleNode: FourHandleNode,
  };

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge({ ...params, id: getId(), animated: true }, eds)
      ),
    [setEdges]
  );

  const [buttonsHidden, setButtonsHidden] = useState(true);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <div className="flex gap-2 absolute top-0 left-0 z-50">
        {buttonsHidden ? (
          <Button onClick={() => setButtonsHidden(false)}>Show Buttons</Button>
        ) : (
          <>
            <Button onClick={() => groupNodesByParent(nodes)}>Group Nodes</Button>
            <Button onClick={() => console.log(JSON.stringify(edges))}>
              Log Edges
            </Button>
            <Button
              onClick={() => {
                localStorage.setItem("nodes", JSON.stringify(nodes));
                localStorage.setItem("edges", JSON.stringify(edges));
              }}
            >
              Save to Local Storage
            </Button>
            <Button
              onClick={() => {
                const savedNodes = JSON.parse(localStorage.getItem("nodes") || "[]");
                const savedEdges = JSON.parse(localStorage.getItem("edges") || "[]");
                setNodes(savedNodes);
                setEdges(savedEdges);
              }}
            >
              Load from Local Storage
            </Button>
            <Button onClick={() => setButtonsHidden(true)}>Hide Buttons</Button>
          </>
        )}
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        snapToGrid={true}
        snapGrid={[10, 10]}
        nodeTypes={customNodeTypes}
        onConnect={onConnect}
        fitView
        className="bg-white"
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
      {/* <div className="absolute bottom-0 left-0 z-50 bg-white max-w-lg">
        <MessagesSection hideSelector context={JSON.stringify(nodes) + JSON.stringify(edges) + "This is a graph of my project. The is context for any questions about the project."} />
      </div> */}
    </div>
  );
}
