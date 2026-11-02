import { Injectable, NotFoundException } from '@nestjs/common';
import { MemoryKind, MemoryProvenance } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const TOKEN_BUDGET_CHARS = 1800;

@Injectable()
export class MemoryService {
  constructor(private prisma: PrismaService) {}

  async list(companyId: string, q?: string) {
    return this.prisma.businessMemory.findMany({
      where: {
        companyId,
        archived: false,
        ...(q
          ? {
              OR: [
                { title: { contains: q } },
                { content: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async create(
    companyId: string,
    userId: string | undefined,
    data: {
      kind: MemoryKind;
      provenance?: MemoryProvenance;
      title: string;
      content: string;
      structured?: object;
      sourceRef?: string;
      confidence?: number;
    },
  ) {
    const existing = await this.prisma.businessMemory.findFirst({
      where: { companyId, archived: false, title: data.title },
    });
    if (existing) {
      return this.prisma.businessMemory.update({
        where: { id: existing.id },
        data: {
          content: data.content,
          kind: data.kind,
          provenance: data.provenance ?? existing.provenance,
          structured: data.structured as object | undefined,
          sourceRef: data.sourceRef,
          confidence: data.confidence ?? existing.confidence,
          editedById: userId ?? existing.editedById,
          supersededById: null,
        },
      });
    }
    return this.prisma.businessMemory.create({
      data: {
        companyId,
        editedById: userId ?? undefined,
        kind: data.kind,
        provenance: data.provenance ?? MemoryProvenance.USER,
        title: data.title,
        content: data.content,
        structured: data.structured as object | undefined,
        sourceRef: data.sourceRef,
        confidence: data.confidence ?? 0.7,
      },
    });
  }

  async update(companyId: string, id: string, userId: string, data: { title?: string; content?: string; archived?: boolean; provenance?: MemoryProvenance }) {
    const mem = await this.prisma.businessMemory.findFirst({ where: { id, companyId } });
    if (!mem) throw new NotFoundException('Memory not found');
    return this.prisma.businessMemory.update({
      where: { id },
      data: { ...data, editedById: userId },
    });
  }

  async remove(companyId: string, id: string) {
    const mem = await this.prisma.businessMemory.findFirst({ where: { id, companyId } });
    if (!mem) throw new NotFoundException('Memory not found');
    await this.prisma.businessMemory.delete({ where: { id } });
    return { ok: true };
  }

  async relevantContext(companyId: string, query: string): Promise<string> {
    const items = await this.prisma.businessMemory.findMany({
      where: { companyId, archived: false, provenance: { not: MemoryProvenance.OUTDATED } },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    });
    const q = query.toLowerCase();
    const scored = items
      .map((m) => {
        const blob = `${m.title} ${m.content}`.toLowerCase();
        let score = m.updatedAt.getTime() / 1e13;
        if (q && blob.includes(q.slice(0, 40))) score += 2;
        q.split(/\s+/).filter((w) => w.length > 3).forEach((w) => {
          if (blob.includes(w)) score += 0.4;
        });
        if (m.provenance === MemoryProvenance.VERIFIED) score += 1;
        if (m.kind === MemoryKind.RULE) score += 0.5;
        return { m, score };
      })
      .sort((a, b) => b.score - a.score);

    const lines: string[] = [];
    let used = 0;
    for (const { m } of scored) {
      const line = `[${m.kind}/${m.provenance}] ${m.title}: ${m.content}`;
      if (used + line.length > TOKEN_BUDGET_CHARS) break;
      lines.push(line);
      used += line.length;
    }
    return lines.length ? `Company memory (filtered):\n${lines.join('\n')}` : '';
  }
}
