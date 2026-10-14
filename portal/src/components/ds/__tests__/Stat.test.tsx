import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Stat } from "../Stat";

describe("Stat", () => {
  it("renders a dash and the reason for missing data, never a zero", () => {
    const { container } = render(
      <Stat label="Requests today" value={null} unavailableReason="Usage could not be loaded." />,
    );
    expect(container).not.toHaveTextContent("0");
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getAllByText("Usage could not be loaded.").length).toBeGreaterThan(0);
  });

  it("treats undefined the same as null", () => {
    render(<Stat label="Active keys" value={undefined} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows a real zero as zero", () => {
    render(<Stat label="Errors" value={0} hint="Last 30 days" />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("Last 30 days")).toBeInTheDocument();
  });

  it("formats numbers with locale grouping", () => {
    render(<Stat label="Requests" value={1288} format={new Intl.NumberFormat("en-US").format} />);
    expect(screen.getByText("1,288")).toBeInTheDocument();
  });

  it("marks itself busy while loading and shows no value", () => {
    const { container } = render(<Stat label="Requests" value={42} loading />);
    expect(container.querySelector("dl")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("42")).not.toBeInTheDocument();
  });
});
