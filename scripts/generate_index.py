#!/usr/bin/env python3
"""Generate lightweight function indexes for large JavaScript files.

This project used to depend on a machine-local code-indexer path. Keeping the
indexer in-repo makes the auto_index workflow portable across Windows and Linux.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Iterable


INDEX_DIR = Path(".cursor") / "rules" / "auto_index"
LINE_THRESHOLD = 500
FUNC_THRESHOLD = 20
MEGA_FUNC_LINES = 200

FUNC_DECL_RE = re.compile(
    r"^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)"
)
ARROW_RE = re.compile(
    r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>"
)
PROPERTY_FUNCTION_RE = re.compile(
    r"^\s*([A-Za-z_$][\w$]*)\s*:\s*(?:async\s+)?function\s*\(([^)]*)\)"
)
METHOD_RE = re.compile(
    r"^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{"
)
SECTION_RE = re.compile(r"@section:([a-z0-9_]+)\s*-\s*(.*)")

RESERVED_METHOD_NAMES = {
    "if",
    "for",
    "while",
    "switch",
    "catch",
    "function",
    "return",
    "typeof",
}


@dataclass
class FunctionInfo:
    name: str
    kind: str
    signature: str
    start: int
    end: int
    sections: list["SectionInfo"] = field(default_factory=list)

    @property
    def length(self) -> int:
        return max(1, self.end - self.start + 1)

    @property
    def is_mega(self) -> bool:
        return self.length > MEGA_FUNC_LINES


@dataclass
class SectionInfo:
    name: str
    description: str
    line: int
    owner: FunctionInfo | None = None


@dataclass
class FileIndex:
    rel_path: str
    lines: int
    functions: list[FunctionInfo]
    sections: list[SectionInfo]
    index_path: str

    @property
    def mega_count(self) -> int:
        return sum(1 for fn in self.functions if fn.is_mega)


def rel_display(path: Path, repo: Path) -> str:
    return str(path.relative_to(repo)).replace("/", "\\")


def index_filename(rel_path: str) -> str:
    return rel_path.replace("\\", "_").replace("/", "_").replace(".", "_") + "_index.md"


def strip_line_comment(line: str) -> str:
    quote: str | None = None
    escaped = False
    for i, ch in enumerate(line):
        if escaped:
            escaped = False
            continue
        if ch == "\\" and quote:
            escaped = True
            continue
        if quote:
            if ch == quote:
                quote = None
            continue
        if ch in {"'", '"', "`"}:
            quote = ch
            continue
        if ch == "/" and i + 1 < len(line) and line[i + 1] == "/":
            return line[:i]
    return line


def find_matching_brace(lines: list[str], start_line: int) -> int:
    """Return the 1-based line where the first opening brace closes."""

    start_index = start_line - 1
    first_brace_col = -1
    for i in range(start_index, len(lines)):
        col = lines[i].find("{")
        if col != -1:
            start_index = i
            first_brace_col = col
            break
    if first_brace_col == -1:
        return start_line

    depth = 0
    state = "code"
    quote = ""
    escaped = False

    for i in range(start_index, len(lines)):
        line = lines[i]
        j = first_brace_col if i == start_index else 0
        while j < len(line):
            ch = line[j]
            nxt = line[j + 1] if j + 1 < len(line) else ""

            if state == "line_comment":
                break
            if state == "block_comment":
                if ch == "*" and nxt == "/":
                    state = "code"
                    j += 2
                    continue
                j += 1
                continue
            if state == "string":
                if escaped:
                    escaped = False
                elif ch == "\\":
                    escaped = True
                elif ch == quote:
                    state = "code"
                j += 1
                continue

            if ch == "/" and nxt == "/":
                state = "line_comment"
                break
            if ch == "/" and nxt == "*":
                state = "block_comment"
                j += 2
                continue
            if ch in {"'", '"', "`"}:
                state = "string"
                quote = ch
                j += 1
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return i + 1
            j += 1
        if state == "line_comment":
            state = "code"

    return len(lines)


def normalize_params(params: str) -> str:
    return " ".join(params.strip().split())


def detect_function(line: str) -> tuple[str, str, str] | None:
    code = strip_line_comment(line)
    match = FUNC_DECL_RE.match(code)
    if match:
        name, params = match.groups()
        return name, "function", f"{name}({normalize_params(params)})"

    match = ARROW_RE.match(code)
    if match:
        name, params = match.groups()
        params = params.strip()
        if params.startswith("(") and params.endswith(")"):
            params = params[1:-1]
        return name, "function", f"{name}({normalize_params(params)})"

    match = PROPERTY_FUNCTION_RE.match(code)
    if match:
        name, params = match.groups()
        return name, "method", f"{name}({normalize_params(params)})"

    match = METHOD_RE.match(code)
    if match:
        name, params = match.groups()
        if name not in RESERVED_METHOD_NAMES:
            return name, "method", f"{name}({normalize_params(params)})"

    return None


def parse_file(path: Path, repo: Path) -> FileIndex:
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    functions: list[FunctionInfo] = []
    sections: list[SectionInfo] = []

    for idx, line in enumerate(lines, start=1):
        section_match = SECTION_RE.search(line)
        if section_match:
            section_name, description = section_match.groups()
            sections.append(SectionInfo(section_name, description.strip(), idx))

        detected = detect_function(line)
        if not detected:
            continue
        if any(fn.start < idx <= fn.end for fn in functions):
            continue
        name, kind, signature = detected
        end = find_matching_brace(lines, idx)
        functions.append(FunctionInfo(name, kind, signature, idx, end))

    for section in sections:
        owners = [fn for fn in functions if fn.start <= section.line <= fn.end]
        if owners:
            section.owner = min(owners, key=lambda fn: fn.length)
            section.owner.sections.append(section)

    rel_path = rel_display(path, repo)
    idx_path = INDEX_DIR / index_filename(rel_path)
    return FileIndex(
        rel_path=rel_path,
        lines=len(lines),
        functions=functions,
        sections=sections,
        index_path=str(idx_path).replace("/", "\\"),
    )


def should_index(file_index: FileIndex, repo: Path, force: bool = False) -> bool:
    if force:
        return True
    if file_index.lines >= LINE_THRESHOLD or len(file_index.functions) >= FUNC_THRESHOLD:
        return True
    existing = repo / file_index.index_path
    return existing.exists()


def write_file_index(repo: Path, file_index: FileIndex) -> None:
    out_path = repo / file_index.index_path
    out_path.parent.mkdir(parents=True, exist_ok=True)
    mega_functions = [fn for fn in file_index.functions if fn.is_mega]
    other_sections = [sec for sec in file_index.sections if not (sec.owner and sec.owner.is_mega)]
    today = date.today().isoformat()

    lines: list[str] = [
        f"# {file_index.rel_path} 函数索引",
        "",
        f"> 自动生成于 {today} | 总行数: {file_index.lines} | 函数数: {len(file_index.functions)} | 语言: javascript",
        "> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**",
        "",
    ]

    if mega_functions:
        lines.extend(
            [
                f"**巨型函数警告**: 本文件包含 {len(mega_functions)} 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。",
                "",
            ]
        )

    lines.extend(
        [
            "## 函数列表",
            "",
            "> 定位方式：在源文件中 `grep -n \"函数名\"` 即可跳转，行号不在此列出（行号随代码变化而失效）。",
            "",
            "| 函数名 | 类型 | 签名 | 备注 |",
            "|--------|------|------|------|",
        ]
    )
    for fn in file_index.functions:
        note = "⚠️ 巨型函数，见 @section 导航" if fn.is_mega else ""
        lines.append(f"| {fn.name} | {fn.kind} | `{fn.signature}` | {note} |")

    if mega_functions:
        lines.extend(["", "## 巨型函数内部节点 (@section 标记)", ""])
        for fn in mega_functions:
            lines.extend([f"### {fn.name}", ""])
            if not fn.sections:
                lines.extend(
                    [
                        "> **缺少 @section 标记**：此巨型函数内部没有节点标记，建议添加以提升导航精度。",
                        "",
                    ]
                )
                continue
            lines.extend(
                [
                    "> 定位：`grep -n '@section:节点名'` 跳转到对应节点",
                    "",
                    "| 节点标记 | 说明 |",
                    "|----------|------|",
                ]
            )
            for section in fn.sections:
                lines.append(f"| `@section:{section.name}` | {section.description} |")
            lines.append("")

    if other_sections:
        lines.extend(["", "## 其他 @section 标记", "", "| 节点标记 | 说明 |", "|----------|------|"])
        for section in other_sections:
            lines.append(f"| `@section:{section.name}` | {section.description} |")

    out_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def iter_js_files(repo: Path, src_dirs: Iterable[str]) -> Iterable[Path]:
    for src_dir in src_dirs:
        root = repo / src_dir
        if not root.exists():
            continue
        if root.is_file() and root.suffix == ".js":
            yield root
            continue
        for path in root.rglob("*.js"):
            if "node_modules" not in path.parts:
                yield path


def skipped_reason(file_index: FileIndex) -> str:
    return (
        "未达阈值"
        f"(行数={file_index.lines}<{LINE_THRESHOLD}, "
        f"函数数={len(file_index.functions)}<{FUNC_THRESHOLD})"
    )


def write_summary(repo: Path, indexed: list[FileIndex], skipped: list[FileIndex]) -> None:
    today = date.today().isoformat()
    indexed_sorted = sorted(indexed, key=lambda item: (-item.lines, item.rel_path))
    skipped_sorted = sorted(skipped, key=lambda item: (-item.lines, item.rel_path))

    lines: list[str] = [
        "# 自动函数索引汇总 (Auto Index)",
        "",
        f"> 自动生成于 {today} | 由 code-indexer 脚本维护",
        "> **本文件由脚本自动生成，严禁手动编辑。**",
        "",
        f"## 已索引文件 ({len(indexed_sorted)} 个)",
        "",
        "| 文件 | 总行数 | 函数数 | 巨型函数 | @section 标记 | 索引文件 |",
        "|------|--------|--------|----------|--------------|---------|",
    ]
    for item in indexed_sorted:
        index_name = Path(item.index_path).name
        lines.append(
            f"| `{item.rel_path}` | {item.lines} | {len(item.functions)} | "
            f"{'**' + str(item.mega_count) + '**' if item.mega_count else '0'} | "
            f"{len(item.sections)} | [{index_name}]({index_name}) |"
        )

    lines.extend(
        [
            "",
            f"## 未索引文件 ({len(skipped_sorted)} 个)",
            "",
            "以下文件未达到大文件阈值，不生成独立索引（可通过 `--force` 强制生成）。",
            "",
            "| 文件 | 行数 | 函数数 |",
            "|------|------|--------|",
        ]
    )
    for item in skipped_sorted:
        lines.append(f"| `{item.rel_path}` | {item.lines} | {len(item.functions)} |")

    (repo / INDEX_DIR / "INDEX.md").write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")

    meta = {
        "indexed": [
            {
                "file": item.rel_path,
                "lines": item.lines,
                "funcs": len(item.functions),
                "sections": len(item.sections),
                "mega_funcs": item.mega_count,
                "index_path": item.index_path,
            }
            for item in indexed_sorted
        ],
        "skipped": [
            {
                "file": item.rel_path,
                "lines": item.lines,
                "funcs": len(item.functions),
                "reason": skipped_reason(item),
            }
            for item in skipped_sorted
        ],
        "warnings": [],
    }
    (repo / INDEX_DIR / "_meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def load_previous_scope(repo: Path) -> set[str]:
    meta_path = repo / INDEX_DIR / "_meta.json"
    if not meta_path.exists():
        return set()
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return set()
    return {entry["file"] for entry in meta.get("indexed", [])}


def build_indexes(args: argparse.Namespace) -> int:
    repo = Path(args.repo).resolve()
    if not repo.exists():
        raise SystemExit(f"Repository path does not exist: {repo}")

    previous_scope = load_previous_scope(repo)

    if args.file:
        target = (repo / args.file).resolve()
        file_index = parse_file(target, repo)
        if not should_index(file_index, repo, args.force):
            print(f"Skipped {file_index.rel_path}: {skipped_reason(file_index)}")
            return 0
        write_file_index(repo, file_index)
        print(f"Indexed {file_index.rel_path} -> {file_index.index_path}")
        return 0

    indexed: list[FileIndex] = []
    skipped: list[FileIndex] = []
    seen: set[Path] = set()
    for path in iter_js_files(repo, args.src_dirs):
        real = path.resolve()
        if real in seen:
            continue
        seen.add(real)
        file_index = parse_file(real, repo)
        if should_index(file_index, repo, args.force or file_index.rel_path in previous_scope):
            write_file_index(repo, file_index)
            indexed.append(file_index)
        else:
            skipped.append(file_index)

    write_summary(repo, indexed, skipped)
    print(f"Indexed {len(indexed)} files; skipped {len(skipped)} files.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Echo Alchemist function indexes.")
    parser.add_argument("repo", help="Repository root path")
    parser.add_argument("--file", help="Relative JS file path to update")
    parser.add_argument(
        "--src-dirs",
        nargs="+",
        default=["src"],
        help="Source directories/files to scan during full generation",
    )
    parser.add_argument("--force", action="store_true", help="Generate indexes regardless of thresholds")
    return build_indexes(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
