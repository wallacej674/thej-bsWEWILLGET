// Apply the saved colour mode before first paint.
try {
  if (localStorage.getItem("applytogether-theme") === "dark") {
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  }
} catch {
  // Storage can be unavailable in restricted browsers.
}
