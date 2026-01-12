//automatically redirected to /login
import { redirect } from "next/navigation";

export default function Home() {
  return redirect("/login");
}