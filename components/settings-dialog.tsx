"use client";

import { useState, useCallback } from "react";
import { Settings, Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "./ui/dialog";
import { getLlmConfig, saveLlmConfig, type LlmConfig } from "@/lib/llm-config";

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<LlmConfig>(() => open ? getLlmConfig() : {
    host: "",
    port: "",
    endpoint: "",
    https: false,
  });
  const [isDark, setIsDark] = useState(() => typeof window !== "undefined" && document.documentElement.classList.contains("dark"));

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setConfig(getLlmConfig());
      setIsDark(typeof window !== "undefined" && document.documentElement.classList.contains("dark"));
    }
  };

  const toggleTheme = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", next);
    }
    localStorage.setItem("theme", next ? "dark" : "light");
  }, [isDark]);

  const handleSave = () => {
    saveLlmConfig(config);
    setOpen(false);
  };

  const protocol = config.https ? "https" : "http";
  const previewUrl = `${protocol}://${config.host}${config.port ? `:${config.port}` : ""}${config.endpoint}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="w-8 h-8">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>LLM Server Settings</DialogTitle>
          <DialogDescription>
            Configure the connection to your LLM server.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Host</label>
            <Input
              value={config.host}
              onChange={(e) => setConfig({ ...config, host: e.target.value })}
              placeholder="e.g. localhost or windows-machine"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Port</label>
            <Input
              value={config.port}
              onChange={(e) => setConfig({ ...config, port: e.target.value })}
              placeholder="e.g. 8080"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Endpoint</label>
            <Input
              value={config.endpoint}
              onChange={(e) =>
                setConfig({ ...config, endpoint: e.target.value })
              }
              placeholder="e.g. /v1/chat/completions"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">HTTPS</label>
            <Button
              variant={config.https ? "default" : "outline"}
              size="sm"
              onClick={() => setConfig({ ...config, https: !config.https })}
            >
              {config.https ? "On" : "Off"}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground break-all">
            URL: {previewUrl}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <label className="text-sm font-medium">Theme</label>
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
