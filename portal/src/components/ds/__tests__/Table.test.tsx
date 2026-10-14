import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../Table";

function KeysTable({ stack }: { stack: boolean }) {
  return (
    <Table caption="API keys" stackOnMobile={stack}>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell>Prefix</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <TableCell label="Name">Server</TableCell>
          <TableCell label="Prefix">pb_live_c3d4</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

describe("Table", () => {
  it("is named by its caption", () => {
    render(<KeysTable stack={false} />);
    expect(screen.getByRole("table", { name: "API keys" })).toBeInTheDocument();
  });

  it("restates table roles when stacking so CSS display changes keep the semantics", () => {
    const { container } = render(<KeysTable stack />);
    expect(container.querySelector("table")).toHaveAttribute("role", "table");
    const cells = screen.getAllByRole("cell");
    expect(cells).toHaveLength(2);
    // The stacked label is visual only; the column header already names the cell.
    expect(within(cells[1]).getByText("Prefix")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
  });

  it("adds no ARIA roles when not stacking", () => {
    const { container } = render(<KeysTable stack={false} />);
    expect(container.querySelector("table")).not.toHaveAttribute("role");
    expect(container.querySelector("td")).not.toHaveAttribute("role");
  });
});
