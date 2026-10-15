export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api" + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-V5-CSRF": "1",
        ...options.headers,
      },
      credentials: "same-origin",
    });
  } catch {
    throw new Error(
      "Não foi possível conectar ao servidor local. Confira se a aplicação está iniciada.",
    );
  }
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(
      "O servidor retornou uma resposta inválida. Tente novamente após verificar o serviço local.",
    );
  }
  if (!res.ok)
    throw new Error(data.error || "Não foi possível realizar a operação.");
  return data;
}
export const send = (path: string, body: any, method = "POST") =>
  api(path, { method, body: JSON.stringify(body) });
export function download(name: string, data: any) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export async function readJSON(file: File) {
  if (file.size > 15 * 1024 * 1024) throw new Error("O arquivo excede 15 MB.");
  try {
    return JSON.parse(await file.text());
  } catch {
    throw new Error("O arquivo não contém JSON válido.");
  }
}
export function imageFile(file: File): Promise<string> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 1500000
  )
    return Promise.reject(new Error("Envie PNG, JPEG ou WebP de até 1,5 MB."));
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    r.readAsDataURL(file);
  });
}
