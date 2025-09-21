# Data directory for store products

This folder hosts your product catalog as JSON to keep the frontend code clean and content easy to edit.

## Files
- `products.json`: The file your site will read from. Keep it committed to the repo.
- `products.sample.json`: A rich example you can copy from.

## Minimal structure (recommended to start)
```json
{
  "currency": "EGP",
  "categories": [],
  "products": []
}
```

## Product (simple)
```json
{
  "id": "p-0001",
  "title": "اسم المنتج",
  "description": "وصف مختصر",
  "price": 0,
  "compareAtPrice": null,
  "currency": "EGP",
  "category": "عام",
  "tags": [],
  "image": "imgs/sample.jpg",
  "inStock": true
}
```

## Product (rich with variants)
See `products.sample.json` for a full example including:
- `categories`
- multiple `images` and a `thumbnail`
- `variants` with `options` (e.g., color, storage) and per-variant `stock`
- `optionsSchema` to define allowed option values
- pricing fields `price` and `compareAtPrice`
- `stockPolicy` = `deny` or `continue`

## Tips
- Use relative image paths like `imgs/phone.jpg` if images are inside the repo; or full URLs if hosted elsewhere.
- Keep `id` and `sku` formats consistent (e.g., `p-0001`, `SKU-...`).
- If you don't need variants, omit the `variants` array and rely on top-level `price` and `inStock`.
- Commit `data/` to Git so GitHub Pages can serve your JSON.
