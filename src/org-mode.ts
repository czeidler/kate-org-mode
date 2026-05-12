declare class Range {
  constructor(
    fromLine: number,
    fromColumn: number,
    toLine: number,
    toColumn: number,
  );
}

declare const document: {
  lines(): number;
  line(i: number): string;
  removeText(range: Range): void;
  insertText(line: number, column: number, text: string): void;
};

declare const view: {
  cursorPosition(): { line: number; column: number };
  setCursorPosition(line: number, column: number): void;
};

function formatDateOrgMode(date: Date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dow = days[date.getDay()];
  return `${date.getFullYear()}-${month}-${day} ${dow}`;
}

function today() {
  return formatDateOrgMode(new Date());
}

function tomorrow() {
  return formatDateOrgMode(new Date(Date.now() + 1000 * 60 * 60 * 24));
}

function updateDateAt(
  lineText: string,
  column: number,
  addDays: number | undefined,
) {
  const startBracketIndex = lineText.lastIndexOf("[", column);
  const endBracketIndex = lineText.indexOf("]", column);
  if (startBracketIndex < 0 || endBracketIndex < 0) {
    return "";
  }

  const bracketText = lineText.slice(startBracketIndex + 1, endBracketIndex);
  const dateText = bracketText.trim().split(" ")[0].slice(0, 10);
  let date = new Date(Date.parse(dateText));
  if (date === null) {
    return "";
  }

  if (addDays !== undefined) {
    date.setDate(date.getDate() + addDays);
  }
  return (
    lineText.slice(0, startBracketIndex + 1) +
    formatDateOrgMode(date) +
    lineText.slice(endBracketIndex)
  );
}

const todoOptions = ["TODO", "DONE"];
const fullOptions = [...todoOptions, ""];

function toggleTodo(
  lineText: string,
  next: "next" | "prev",
  line: number,
  column: number,
): [string, { line: number; column: number }] {
  const prefix = /^\*+\s+/.exec(lineText);
  if (!prefix) {
    return ["", { line, column }];
  }

  const existingOptionIdx = fullOptions.findIndex((it) =>
    lineText.startsWith(it, prefix[0].length),
  );
  const existingOption = fullOptions[existingOptionIdx] ?? "";
  let nextIdx = next === "next" ? existingOptionIdx + 1 : existingOptionIdx - 1;
  if (nextIdx < 0) {
    nextIdx = fullOptions.length - 1;
  } else if (nextIdx >= fullOptions.length) {
    nextIdx = 0;
  }
  const nextOption = fullOptions[nextIdx];
  const newTodoLine = `${prefix[0].trim()}${nextOption === "" ? " " : ` ${nextOption} `}${lineText.slice(prefix[0].length + existingOption.length).trim()}`;
  const columnDiff =
    column <= prefix[0].length + existingOption.length
      ? 0
      : newTodoLine.length - lineText.length;
  return [newTodoLine, { line, column: column + columnDiff }];
}

function toggleTable(
  lineText: string,
  line: number,
  column: number,
  next: "next" | "prev",
): [string[], number, number, { line: number; column: number }] {
  const testRegEx = /^\s*\|/;
  const prevLines = [];
  for (let i = line - 1; i >= 0; i--) {
    const l = document.line(i);
    if (!l || testRegEx.exec(l) === null) {
      break;
    }
    prevLines.push(l);
  }
  const nextLines = [];
  for (let i = line + 1; i < document.lines(); i++) {
    const l = document.line(i);
    if (testRegEx.exec(l) === null) {
      break;
    }
    nextLines.push(l);
  }
  const tableLines = [...prevLines.reverse(), lineText, ...nextLines];
  const tableRaw: string[][] = tableLines.map((it) => it.split("|"));
  const tableStartLine = line - prevLines.length;
  // table index of the trigger line
  const tableLineIndex = prevLines.length;

  // get cursor cell
  const cursorRow = tableRaw[tableLineIndex];
  let cursorRowPos = 0;
  // in the raw line the first cell is before the table
  let cursorRowCell = -2;
  for (const cursorCell of cursorRow) {
    cursorRowCell += 1;
    cursorRowPos += cursorCell.length + 1;
    if (cursorRowPos > column) {
      break;
    }
  }

  const table: { cells: string[]; isSeparator: boolean }[] = tableRaw.map(
    (line) => {
      const cells = line.slice(1, -1).map((it) => it.trim());
      const endCell = line[line.length - 1].trim();
      if (endCell.length > 0) {
        cells.push(endCell);
      }
      return {
        isSeparator: line[1] ? line[1].startsWith("-") : false,
        cells,
      };
    },
  );
  const columnSize: number[] = [];
  for (const row of table) {
    for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex++) {
      const c = row.cells[cellIndex];
      const length = row.isSeparator ? 1 : c.length;
      const existing = columnSize[cellIndex];
      if (existing === undefined) {
        columnSize.push(length);
      } else {
        columnSize[cellIndex] = existing < length ? length : existing;
      }
    }
  }

  // calculate new cursor position
  let cursorLine = line;
  let nextCursorCell = next === "next" ? cursorRowCell + 1 : cursorRowCell - 1;
  const cursorToNextRow = () => {
    nextCursorCell = 0;
    if (tableLineIndex + 1 < table.length) {
      for (let i = tableLineIndex + 1; i < table.length; i++) {
        const row = table[i];
        if (row.isSeparator === false) {
          cursorLine = tableStartLine + i;
          break;
        }
      }
    } else {
      cursorLine = tableStartLine + table.length;
    }
  };
  const cursorToPrevRow = () => {
    if (tableLineIndex > 0) {
      for (let i = tableLineIndex - 1; i >= 0; i--) {
        const row = table[i];
        if (row.isSeparator === false) {
          nextCursorCell = columnSize.length - 1;
          cursorLine = tableStartLine + i;
          break;
        }
      }
    } else {
      nextCursorCell = 0;
    }
  };
  if (table[tableLineIndex].isSeparator) {
    if (next === "next") {
      cursorToNextRow();
    } else {
      cursorToPrevRow();
    }
  } else if (nextCursorCell >= columnSize.length) {
    cursorToNextRow();
  } else if (nextCursorCell < 0) {
    cursorToPrevRow();
  }
  const padding = /^\s*/.exec(tableLines[0]) ?? "";
  let cursorColumn = padding.length + 1;
  for (let i = 0; i < nextCursorCell; i++) {
    cursorColumn += columnSize[i] + 3;
  }

  // add new table row if we reached the bottom
  if (cursorLine >= tableStartLine + table.length) {
    table.push({ isSeparator: false, cells: [] });
  }

  const formattedTableRows = table.map((row) => {
    const outColumns = [];
    for (let i = 0; i < columnSize.length; i++) {
      if (row.isSeparator) {
        outColumns.push(`${"-".padEnd(columnSize[i] + 2, "-")}`);
      } else {
        outColumns.push(` ${(row.cells[i] ?? "").padEnd(columnSize[i])} `);
      }
    }
    return `${padding}|${row.isSeparator ? outColumns.join("+") : outColumns.join("|")}|`;
  });

  const originalTableHeight = tableLines.length;
  return [
    formattedTableRows,
    tableStartLine,
    originalTableHeight,
    { line: cursorLine, column: cursorColumn },
  ];
}

function toggleNextPrev(next: "next" | "prev") {
  const cursor = view.cursorPosition();
  const lineText = document.line(cursor.line);
  const column = cursor.column;

  // date
  const startBracketIndex = lineText.lastIndexOf("[", column);
  const endBracketIndex = lineText.indexOf("]", column);
  if (startBracketIndex >= 0 && endBracketIndex >= 0) {
    const dateLine = updateDateAt(lineText, column, next === "next" ? 1 : -1);
    const columnDiff = dateLine.length - lineText.length;
    document.removeText(new Range(cursor.line, 0, cursor.line, 999999));
    document.insertText(cursor.line, 0, dateLine);
    view.setCursorPosition(cursor.line, column + columnDiff);
    return "";
  }

  // todo
  if (lineText.startsWith("*")) {
    const todoResult = toggleTodo(lineText, next, cursor.line, column);
    const todoLine = todoResult[0];
    const newCursor = todoResult[1];
    document.removeText(new Range(cursor.line, 0, cursor.line, 999999));
    document.insertText(cursor.line, 0, todoLine);
    view.setCursorPosition(newCursor.line, newCursor.column);
    return "";
  }

  // table
  if (/^\s*\|/.exec(lineText) !== null) {
    const tableResult = toggleTable(lineText, cursor.line, column, next);
    const tableLines = tableResult[0];
    const tableStartLine = tableResult[1];
    const originalTableHeight = tableResult[2];
    const newCursor = tableResult[3];
    document.removeText(
      new Range(
        tableStartLine,
        0,
        tableStartLine + originalTableHeight - 1,
        999999,
      ),
    );
    document.insertText(tableStartLine, 0, tableLines.join("\n"));
    view.setCursorPosition(newCursor.line, newCursor.column);
    return "";
  }

  return "";
}
