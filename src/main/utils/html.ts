export default class HTML {
    public static escape(value: string): string {
        if (value === null || value === undefined) {
            return value;
        }
    
        const strValue = String(value);
    
        return strValue
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
    }
}