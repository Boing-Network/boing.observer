import { describe, expect, it } from "vitest";
import { navItemIsActive, type NavItem } from "./nav";

describe("navItemIsActive", () => {
  it("matches Home only at the root path", () => {
    const home: NavItem = { href: "/", label: "Home", exact: true };
    expect(navItemIsActive("/", home)).toBe(true);
    expect(navItemIsActive("/about", home)).toBe(false);
  });

  it("treats nested routes as active unless exact", () => {
    const tokens: NavItem = { href: "/tokens", label: "Token index" };
    expect(navItemIsActive("/tokens", tokens)).toBe(true);
    expect(navItemIsActive("/tokens/abc", tokens)).toBe(true);
    expect(navItemIsActive("/tools", tokens)).toBe(false);
  });

  it("does not mark QA as active on /qa/rules when exact", () => {
    const qa: NavItem = { href: "/qa", label: "QA", exact: true };
    expect(navItemIsActive("/qa", qa)).toBe(true);
    expect(navItemIsActive("/qa/rules", qa)).toBe(false);
  });

  it("ignores external items", () => {
    const wallet: NavItem = { href: "https://boing.express", label: "Wallet", external: true };
    expect(navItemIsActive("/", wallet)).toBe(false);
  });
});
