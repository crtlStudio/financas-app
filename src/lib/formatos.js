// Formatos de números à portuguesa

// 0.487 -> "48,7%"
export const percentagem = (parte, total) =>
  (total ? (parte / total) * 100 : 0).toLocaleString('pt-PT', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + '%'
