import { render } from "solid-js/web"
import { App } from "@/app/components/app"
import { installZoom } from "@/app/utilities/zoom"
import "@/styles.css"

installZoom()

const root = document.getElementById("root")

if (root) {
  render(() => <App />, root)
}
