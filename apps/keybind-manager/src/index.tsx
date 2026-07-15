import { render } from "solid-js/web"
import { App } from "@/app/components/app"
import "@/styles.css"

const root = document.getElementById("root")

if (root) {
  render(() => <App />, root)
}
