"use client";

import { type FC, useEffect, useState } from "react";
import { Check, Copy, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReactComponentPreviewProps {
  code: string;
  className?: string;
  externalCss?: string;
  title?: string;
  defaultPreviewVisible?: boolean;
  showChrome?: boolean;
}

function extractComponentName(code: string): string | null {
  let match = code.match(/export\s+default\s+function\s+([A-Z]\w*)/);
  if (match) return match[1];

  match = code.match(/export\s+default\s+class\s+([A-Z]\w*)/);
  if (match) return match[1];

  match = code.match(/export\s+default\s+([A-Z]\w*)\s*;?\s*$/m);
  if (match) return match[1];

  const namedExports: string[] = [];
  const exportRegex = /export\s+(?:const|function|class)\s+([A-Z]\w*)/g;
  while ((match = exportRegex.exec(code)) !== null) {
    namedExports.push(match[1]);
  }

  if (namedExports.length > 0) {
    return namedExports[namedExports.length - 1];
  }

  const declarations: string[] = [];
  const declarationRegex = /(?:const|function|class)\s+([A-Z]\w*)/g;
  while ((match = declarationRegex.exec(code)) !== null) {
    declarations.push(match[1]);
  }

  return declarations.length > 0 ? declarations[declarations.length - 1] : null;
}

function collectDeclaredPascalNames(code: string): string[] {
  const names = new Set<string>();
  const declarationRegex = /(?:const|let|var|function|class)\s+([A-Z]\w*)/g;
  let match: RegExpExecArray | null;

  while ((match = declarationRegex.exec(code)) !== null) {
    names.add(match[1]);
  }

  return Array.from(names);
}

function processCode(rawCode: string): {
  processedCode: string;
  componentName: string | null;
  extractedCss: string;
  declaredPascalNames: string[];
} {
  const componentName = extractComponentName(rawCode);

  let extractedCss = "";
  let code = rawCode.replace(
    /<style[\s\S]*?>([\s\S]*?)<\/style>/g,
    (_match, css) => {
      extractedCss += `${css}\n`;
      return "";
    }
  );

  code = code.replace(/^['"]use (client|server)['"];?\s*$/gm, "");
  code = code.replace(
    /^import\s+type\s[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm,
    ""
  );
  code = code.replace(
    /^import\s*\{[\s\S]*?\}\s*from\s+['"][^'"]+['"];?\s*$/gm,
    ""
  );
  code = code.replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, "");
  code = code.replace(/^import\s+['"][^'"]+['"];?\s*$/gm, "");
  code = code.replace(
    /(?:const|let|var)\s+.*?=\s*require\(['"][^'"]+['"]\);?\s*/g,
    ""
  );

  code = code.replace(/className=\{styles\.(\w+)\}/g, 'className="$1"');
  code = code.replace(/className=\{styles\[['"](\w+)['"]\]\}/g, 'className="$1"');
  code = code.replace(/styles\.(\w+)/g, '"$1"');

  code = code.replace(/^export\s+default\s+function\s/gm, "function ");
  code = code.replace(/^export\s+default\s+class\s/gm, "class ");
  code = code.replace(/^export\s+default\s+([A-Z]\w*)\s*;?\s*$/gm, "");
  code = code.replace(/^export\s+(const|let|var|function|class)\s/gm, "$1 ");
  code = code.replace(/^export\s+(interface|type)\s/gm, "$1 ");

  const processedCode = code.trim();

  return {
    processedCode,
    componentName,
    extractedCss: extractedCss.trim(),
    declaredPascalNames: collectDeclaredPascalNames(processedCode),
  };
}

function escapeStyleContent(css: string): string {
  return css.replace(/<\/style>/gi, "<\\/style>");
}

function buildIframeHTML(params: {
  processedCode: string;
  componentName: string;
  cssBundle: string;
  declaredPascalNames: string[];
}): string {
  return `<!DOCTYPE html>
<html style="height:100%">
<head>
<meta charset="utf-8">
<script src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
<script src="https://cdn.tailwindcss.com"><\/script>
<style>body{margin:0;font-family:system-ui,-apple-system,sans-serif;min-height:100%}*{box-sizing:border-box}</style>
<style id="artifact-css">${escapeStyleContent(params.cssBundle)}<\/style>
</head>
<body style="height:100%">
<div id="root" style="height:100%"></div>
<div id="loading" style="padding:1rem;color:#888;font-size:0.875rem">Loading preview...</div>
<script>
function __d(base){return function(p){p=p||{};var o=Object.assign({},p),c=((base||'')+(p.className?' '+p.className:'')).trim();delete o.className;delete o.children;delete o.variant;delete o.size;delete o.asChild;return React.createElement('div',Object.assign({className:c},o),p.children)}}
function __e(tag,base){return function(p){p=p||{};var o=Object.assign({},p),c=((base||'')+(p.className?' '+p.className:'')).trim();delete o.className;delete o.children;delete o.variant;delete o.size;delete o.asChild;return React.createElement(tag,Object.assign({className:c},o),p.children)}}
function __p(){return function(p){return(p&&p.children)||null}}
function __btn(){return function(p){p=p||{};var o=Object.assign({},p),c=('inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors border'+(p.className?' '+p.className:'')).trim();delete o.className;delete o.children;delete o.variant;delete o.size;delete o.asChild;return React.createElement('button',Object.assign({className:c},o),p.children)}}

var __M={
React:React,
useState:React.useState,useEffect:React.useEffect,useRef:React.useRef,
useMemo:React.useMemo,useCallback:React.useCallback,useContext:React.useContext,
useReducer:React.useReducer,useId:React.useId||function(){return'id'},
createContext:React.createContext,forwardRef:React.forwardRef,
Fragment:React.Fragment,Children:React.Children,
cloneElement:React.cloneElement,createElement:React.createElement,
memo:React.memo,lazy:React.lazy,Suspense:React.Suspense,
cn:function(){return Array.prototype.filter.call(arguments,Boolean).join(' ')},
clsx:function(){return Array.prototype.filter.call(arguments,Boolean).join(' ')},
Card:__d('bg-white rounded-lg border shadow-sm'),
CardHeader:__d('flex flex-col space-y-1.5 p-6'),
CardTitle:__e('h3','text-2xl font-semibold leading-none tracking-tight'),
CardDescription:__e('p','text-sm text-gray-500'),
CardContent:__d('p-6 pt-0'),
CardFooter:__d('flex items-center p-6 pt-0'),
Button:__btn(),
Input:function(p){p=p||{};var o=Object.assign({},p),c=('flex h-10 w-full rounded-md border px-3 py-2 text-sm'+(p.className?' '+p.className:'')).trim();delete o.className;delete o.variant;delete o.size;return React.createElement('input',Object.assign({className:c},o))},
Textarea:__e('textarea','flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm'),
Label:__e('label','text-sm font-medium leading-none'),
Badge:__e('span','inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold'),
Separator:function(){return React.createElement('hr',{className:'border-t my-2'})},
Avatar:__d('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100'),
AvatarImage:function(p){return React.createElement('img',{src:p&&p.src,className:'aspect-square h-full w-full',alt:''})},
AvatarFallback:__d('flex h-full w-full items-center justify-center rounded-full bg-gray-200'),
Switch:function(p){p=p||{};return React.createElement('button',{role:'switch',className:'relative inline-flex h-6 w-11 items-center rounded-full transition-colors '+(p.checked?'bg-blue-600':'bg-gray-200'),onClick:function(){p.onCheckedChange&&p.onCheckedChange(!p.checked)}},React.createElement('span',{className:'inline-block h-4 w-4 transform rounded-full bg-white transition '+(p.checked?'translate-x-6':'translate-x-1')}))},
Checkbox:function(p){p=p||{};return React.createElement('input',{type:'checkbox',checked:p.checked,onChange:function(e){p.onCheckedChange&&p.onCheckedChange(e.target.checked)},className:'h-4 w-4 rounded border '+(p.className||'')})},
Select:__p(),SelectTrigger:__btn(),SelectContent:__d('bg-white border rounded-md shadow-lg p-1'),
SelectItem:__d('px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 rounded'),
SelectValue:function(p){return React.createElement('span',null,p&&p.placeholder||'')},
Tabs:__d(''),TabsList:__d('inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1'),
TabsTrigger:__btn(),TabsContent:__d('mt-2'),
Dialog:__p(),DialogTrigger:__p(),DialogContent:__d('bg-white rounded-lg shadow-lg p-6 max-w-lg mx-auto'),
DialogHeader:__d('flex flex-col space-y-1.5'),DialogTitle:__e('h2','text-lg font-semibold'),
DialogDescription:__e('p','text-sm text-gray-500'),DialogFooter:__d('flex justify-end gap-2 pt-4'),DialogClose:__p(),
Alert:__d('relative w-full rounded-lg border p-4'),
AlertTitle:__e('h5','mb-1 font-medium leading-none tracking-tight'),
AlertDescription:__e('div','text-sm'),
Table:__e('table','w-full caption-bottom text-sm'),TableHeader:__e('thead',''),
TableBody:__e('tbody',''),TableRow:__e('tr','border-b'),
TableHead:__e('th','h-12 px-4 text-left align-middle font-medium text-gray-500'),
TableCell:__e('td','p-4 align-middle'),
ScrollArea:__d('overflow-auto'),
Progress:function(p){p=p||{};return React.createElement('div',{className:'relative h-4 w-full overflow-hidden rounded-full bg-gray-100'},React.createElement('div',{className:'h-full bg-blue-600 rounded-full transition-all',style:{width:(p.value||0)+'%'}}))},
Slider:__d('relative flex w-full touch-none select-none items-center h-5'),
Accordion:__d(''),AccordionItem:__d('border-b'),AccordionTrigger:__btn(),AccordionContent:__d('pb-4 pt-0'),
Sheet:__p(),SheetTrigger:__p(),SheetContent:__d('bg-white shadow-lg p-6'),
Tooltip:__p(),TooltipTrigger:__p(),TooltipContent:__d('bg-black text-white text-xs rounded px-2 py-1'),TooltipProvider:__p(),
Popover:__p(),PopoverTrigger:__p(),PopoverContent:__d('bg-white border rounded-md shadow-lg p-4'),
DropdownMenu:__p(),DropdownMenuTrigger:__p(),DropdownMenuContent:__d('bg-white border rounded-md shadow-lg p-1'),
DropdownMenuItem:__d('px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 rounded'),
DropdownMenuSeparator:function(){return React.createElement('hr',{className:'my-1 border-t'})},
};

var __L=new Proxy({},{get:function(_,n){if(typeof n!=='string')return undefined;return function(p){p=p||{};var s=p.size||p.width||24;return React.createElement('svg',{width:s,height:s,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round',className:p.className||'',style:p.style},React.createElement('rect',{x:3,y:3,width:18,height:18,rx:2,opacity:0.15}),React.createElement('text',{x:12,y:16,textAnchor:'middle',fontSize:7,fill:'currentColor',stroke:'none'},(n||'').substring(0,4)))}}});

var motion=new Proxy({},{get:function(_,tag){return function(p){p=p||{};var o=Object.assign({},p);['initial','animate','exit','transition','variants','whileHover','whileTap','whileInView','whileFocus','whileDrag','layout','layoutId','drag','dragConstraints','onAnimationComplete'].forEach(function(k){delete o[k]});return React.createElement(tag,o,p.children)}}});
var AnimatePresence=__p();
var LayoutGroup=__p();

var __R={
ResponsiveContainer:function(p){return React.createElement('div',{style:{width:'100%',height:(p&&p.height)||300}},p&&p.children)},
BarChart:function(){return React.createElement('div',{className:'flex items-end gap-1 h-full p-4'},React.createElement('span',{className:'text-xs text-gray-400'},'[Bar Chart]'))},
LineChart:function(){return React.createElement('div',{className:'h-full p-4',style:{background:'#fafafa'}},React.createElement('span',{className:'text-xs text-gray-400'},'[Line Chart]'))},
PieChart:function(){return React.createElement('div',{className:'h-full p-4 flex items-center justify-center'},React.createElement('span',{className:'text-xs text-gray-400'},'[Pie Chart]'))},
AreaChart:function(){return React.createElement('div',{className:'h-full p-4'},React.createElement('span',{className:'text-xs text-gray-400'},'[Area Chart]'))},
Bar:function(){return null},Line:function(){return null},Area:function(){return null},
XAxis:function(){return null},YAxis:function(){return null},CartesianGrid:function(){return null},
Tooltip:function(){return null},Legend:function(){return null},Cell:function(){return null},
Pie:function(){return null},RadialBarChart:function(p){return React.createElement('div',{className:'h-full p-4'},p&&p.children)},
RadialBar:function(){return null},
};

var styled=new Proxy({},{get:function(_,tag){return function(){return function(p){p=p||{};var o=Object.assign({},p);delete o.children;return React.createElement(tag,o,p.children)}}}});

function __run(){
var ld=document.getElementById('loading');if(ld)ld.remove();
var code=${JSON.stringify(params.processedCode)};
var name=${JSON.stringify(params.componentName)};
try{
var transpiled=Babel.transform(code,{presets:['react','typescript'],filename:'component.tsx'}).code;
var decls=Object.keys(__M).map(function(n){return'var '+n+'=__M.'+n+';'}).join('\\n');
var pascalRe=/\\b([A-Z][a-zA-Z0-9]+)\\b/g;
var seen={};var lucDecls=[];var m;
var declared=${JSON.stringify(params.declaredPascalNames)};
var builtins=['React','ReactDOM','Babel','Object','Array','Function','Date','Math','JSON','String','Number','Boolean','Error','RegExp','Promise','Map','Set','Symbol','Proxy','Reflect','Infinity','NaN','HTMLElement','Element','Event','Node','NodeList','Window','Document'];
while((m=pascalRe.exec(transpiled))!==null){var id=m[1];if(!seen[id]&&!__M[id]&&!__R[id]&&builtins.indexOf(id)===-1&&declared.indexOf(id)===-1){seen[id]=true;lucDecls.push('var '+id+'=__L.'+id+';')}}
var rDecls=Object.keys(__R).map(function(n){return'var '+n+'=__R.'+n+';'}).join('\\n');
var full=decls+'\\n'+lucDecls.join('\\n')+'\\n'+rDecls+'\\n'+'var motion=__motion;var AnimatePresence=__AP;var LayoutGroup=__LG;var styled=__st;\\n'+transpiled+'\\nreturn typeof '+name+'!==\"undefined\"?'+name+':null;';
var factory=new Function('__M','__L','__R','__motion','__AP','__LG','__st',full);
var Comp=factory(__M,__L,__R,motion,AnimatePresence,LayoutGroup,styled);
if(Comp){
var root=ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(Comp));
if(typeof ResizeObserver!=='undefined'){new ResizeObserver(function(entries){var h=entries[0].target.scrollHeight;window.parent.postMessage({type:'preview-height',height:h},'*')}).observe(document.getElementById('root'))}
}else{throw new Error('Component \"'+name+'\" not found')}
}catch(err){
var el=document.getElementById('root');el.innerHTML='';
var c=document.createElement('div');c.style.cssText='padding:1rem;font-family:ui-monospace,monospace;font-size:0.8rem';
var t=document.createElement('div');t.style.cssText='color:#ef4444;font-weight:bold;margin-bottom:0.5rem';t.textContent='Preview Error';
var msg=document.createElement('pre');msg.style.cssText='color:#f87171;white-space:pre-wrap;word-break:break-word;background:#fafafa;padding:0.75rem;border-radius:0.375rem;overflow:auto;max-height:200px';
msg.textContent=err.message;c.appendChild(t);c.appendChild(msg);el.appendChild(c);
window.parent.postMessage({type:'preview-error',message:err.message},'*');
}}

function __wait(){if(typeof React!=='undefined'&&typeof ReactDOM!=='undefined'&&typeof Babel!=='undefined'){__run()}else{setTimeout(__wait,50)}}
__wait();
<\/script>
</body>
</html>`;
}

export const ReactComponentPreview: FC<ReactComponentPreviewProps> = ({
  code,
  className,
  externalCss = "",
  title = "React Component",
  defaultPreviewVisible = false,
  showChrome = true,
}) => {
  const previewKey = `${code}\u0000${externalCss}`;

  const [copied, setCopied] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(
    showChrome ? defaultPreviewVisible : true
  );
  const [errorState, setErrorState] = useState<{
    key: string;
    message: string | null;
  }>({
    key: previewKey,
    message: null,
  });
  const [iframeHeightState, setIframeHeightState] = useState<{
    key: string;
    height: number;
  }>({
    key: previewKey,
    height: 400,
  });

  const previewVisible = showChrome ? isPreviewVisible : true;
  const error = errorState.key === previewKey ? errorState.message : null;
  const iframeHeight =
    iframeHeightState.key === previewKey ? iframeHeightState.height : 400;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "preview-error") {
        setErrorState({
          key: previewKey,
          message: event.data.message,
        });
      }

      if (
        event.data?.type === "preview-height" &&
        typeof event.data.height === "number"
      ) {
        setIframeHeightState({
          key: previewKey,
          height: Math.min(Math.max(event.data.height + 20, 200), 800),
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [previewKey]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { processedCode, componentName, extractedCss, declaredPascalNames } =
    processCode(code);
  const cssBundle = [externalCss.trim(), extractedCss.trim()]
    .filter(Boolean)
    .join("\n\n");

  const previewContent = (() => {
    if (!previewVisible) return null;

    if (!componentName) {
      return (
        <div className="p-4 text-sm text-muted-foreground">
          No React component found in the code.
        </div>
      );
    }

    const html = buildIframeHTML({
      processedCode,
      componentName,
      cssBundle,
      declaredPascalNames,
    });

    return (
      <iframe
        srcDoc={html}
        className="w-full border-none"
        style={{ height: iframeHeight }}
        sandbox="allow-scripts"
        title={title}
      />
    );
  })();

  if (!showChrome) {
    return (
      <div className={cn("h-full w-full rounded-lg border border-border bg-card", className)}>
        {error ? (
          <div className="p-4">
            <p className="text-sm font-medium text-destructive">Preview Error</p>
            <pre className="mt-1 whitespace-pre-wrap text-xs text-destructive/80">
              {error}
            </pre>
          </div>
        ) : (
          previewContent
        )}
      </div>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="sr-only">Copy code</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8"
            onClick={() => {
              setIsPreviewVisible(!previewVisible);
              setErrorState({
                key: previewKey,
                message: null,
              });
            }}
          >
            <Play className="h-4 w-4" />
            <span className="sr-only">Toggle preview</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {previewVisible ? (
          <div className="mt-4 border-t border-border pt-4">
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {error ? (
                <div className="p-4">
                  <p className="text-sm font-medium text-destructive">Preview Error</p>
                  <pre className="mt-1 whitespace-pre-wrap text-xs text-destructive/80">
                    {error}
                  </pre>
                </div>
              ) : (
                previewContent
              )}
            </div>
          </div>
        ) : (
          <pre className="relative rounded-md bg-muted p-4">
            <code className="block whitespace-pre-wrap text-sm font-mono text-muted-foreground">
              {code}
            </code>
          </pre>
        )}
      </CardContent>
    </Card>
  );
};
