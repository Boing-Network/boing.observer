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

  it("does not mark Tools as active on nested tool pages when exact", () => {
    const tools: NavItem = { href: "/tools", label: "Tools", exact: true };
    expect(navItemIsActive("/tools", tools)).toBe(true);
    expect(navItemIsActive("/tools/rpc-catalog", tools)).toBe(false);
  });

  it("ignores external items", () => {
    const wallet: NavItem = { href: "https://boing.express", label: "Wallet", external: true };
    expect(navItemIsActive("/", wallet)).toBe(false);
  });
});
