import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const promptPath = path.join(process.cwd(), "lib", "prompt.txt");
    const prompt = fs.readFileSync(promptPath, "utf8");
    return NextResponse.json({ prompt });
  } catch {
    return NextResponse.json({ error: 'Failed to load prompt' }, { status: 500 });
  }
} 