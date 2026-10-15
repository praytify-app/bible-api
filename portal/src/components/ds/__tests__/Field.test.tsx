import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field, Input, TextArea } from "../Field";

describe("Field", () => {
  it("labels the control and links hint and error through aria-describedby", () => {
    render(
      <Field label="Allowed origin" hint="https://host or https://*.host" error="Use https://" required>
        <Input defaultValue="http://example.com" />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Allowed origin" });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Use https:// https://host or https://*.host");
  });

  it("is valid and described by the hint alone without an error", () => {
    render(
      <Field label="Name" hint="Shown only to you">
        <TextArea />
      </Field>,
    );
    const textarea = screen.getByRole("textbox", { name: "Name" });
    expect(textarea).not.toHaveAttribute("aria-invalid");
    expect(textarea).toHaveAccessibleDescription("Shown only to you");
  });

  it("keeps a control's own describedby alongside the field's", () => {
    render(
      <>
        <p id="extra">Extra context</p>
        <Field label="Name" error="Required">
          <Input aria-describedby="extra" />
        </Field>
      </>,
    );
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAccessibleDescription("Required Extra context");
  });

  it("keeps a visually hidden label in the accessible name", () => {
    render(
      <Field label="Search translations" hideLabel>
        <Input type="search" />
      </Field>,
    );
    expect(screen.getByRole("searchbox", { name: "Search translations" })).toBeInTheDocument();
  });
});
