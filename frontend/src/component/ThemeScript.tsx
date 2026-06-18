// Injected before first paint to prevent theme flash on page load
export function ThemeScript() {
  const script = `try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
