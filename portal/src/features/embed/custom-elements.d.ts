// JSX types for the widget's custom elements (packages/embed). React 19 hands
// these props to the element as properties; the widget reflects each one to
// its attribute, so either path renders the same thing.

import type { DetailedHTMLProps, HTMLAttributes } from "react";

interface PraytifyWidgetProps extends DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> {
  version?: string;
  theme?: "auto" | "light" | "dark";
  /** "false" hides the "Read the chapter" link. */
  link?: string;
  /** "false" hides the translation's attribution. */
  attribution?: string;
  api?: string;
  reader?: string;
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "praytify-verse": PraytifyWidgetProps & { reference?: string };
      "praytify-daily": PraytifyWidgetProps;
    }
  }
}
