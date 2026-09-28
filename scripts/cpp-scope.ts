const stripLiterals = (line: string) => line
  .replace(/"(?:\\.|[^"\\])*"/g, "\"\"")
  .replace(/'(?:\\.|[^'\\])*'/g, "''")
  .replace(/\/\/.*$/, "");

type Block = {start: number; end: number};

const declarationOnLine = (line: string, candidate: string) => {
  const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const commonType = /\b(?:auto|bool|char|short|int|long|float|double|size_t|string|vector|array|deque|map|set|stack|queue|unordered_map|unordered_set)\b/;
  const customTypeBeforeName = new RegExp(`(?:^|[;(,])\\s*(?:const\\s+)?[A-Za-z_]\\w*(?:::[A-Za-z_]\\w*)*(?:\\s*<[^;{}]+>)?\\s*[&*]?\\s+${escaped}\\b`);
  const name = new RegExp(`\\b${escaped}\\b`, "g");
  for (const match of line.matchAll(name)) {
    const before = line.slice(0, match.index);
    const statementStart = Math.max(before.lastIndexOf(";"), before.lastIndexOf("{"), before.lastIndexOf("}"));
    const declarationPrefix = before.slice(statementStart + 1);
    if (commonType.test(declarationPrefix) || customTypeBeforeName.test(line)) return match.index;
  }
  return -1;
};

export const visibleCandidatesByLine = (source: string, candidates: string[]) => {
  const lines = source.split(/\r?\n/);
  const sanitized = lines.map(stripLiterals);
  const blocks: Block[] = [];
  const stack: Block[] = [];
  for (let index = 0; index < sanitized.length; index++) {
    for (const character of sanitized[index]) {
      if (character === "{") {
        const block = {start: index + 1, end: lines.length};
        blocks.push(block);
        stack.push(block);
      } else if (character === "}") {
        const block = stack.pop();
        if (block) block.end = index + 1;
      }
    }
  }

  const scopes = new Map<string, Array<{start: number; end: number}>>();
  for (const candidate of candidates) {
    for (let index = 0; index < sanitized.length; index++) {
      const declarationIndex = declarationOnLine(sanitized[index], candidate);
      if (declarationIndex === -1) continue;
      const lineNumber = index + 1;
      const opensOwnBlock = sanitized[index].indexOf("{", declarationIndex) !== -1;
      const containing = blocks.filter((block) => block.start <= lineNumber && lineNumber <= block.end);
      const ownBlocks = opensOwnBlock ? containing.filter((block) => block.start === lineNumber) : [];
      const ownBlock = ownBlocks[ownBlocks.length - 1];
      const scope = ownBlock ?? containing[containing.length - 1];
      if (scope) {
        const intervals = scopes.get(candidate) ?? [];
        intervals.push({start: lineNumber, end: scope.end});
        scopes.set(candidate, intervals);
      }
    }
  }

  return new Map(lines.map((_, index) => {
    const lineNumber = index + 1;
    const visible = candidates.filter((candidate) => scopes.get(candidate)?.some((scope) => scope.start <= lineNumber && lineNumber <= scope.end));
    return [lineNumber, visible] as const;
  }));
};
