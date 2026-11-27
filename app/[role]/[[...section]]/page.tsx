import { notFound, redirect } from "next/navigation";
import Workspace from "@/components/Workspace";
import { portals } from "@/lib/demo";

export const instant = false;

export default async function WorkspacePage({ params }: { params: Promise<{ role: string; section?: string[] }> }) {
  const { role, section = [] } = await params;
  if (!portals[role]) notFound();
  if (role === "admin") redirect("/admin");
  const validSections = portals[role].menu.map(label => label.toLowerCase().replaceAll(" & ", "-and-").replaceAll(" ", "-"));
  if (section.length && !validSections.includes(section.join("-"))) notFound();
  return <Workspace role={role} section={section} />;
}
