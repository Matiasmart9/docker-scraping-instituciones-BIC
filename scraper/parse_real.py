from bs4 import BeautifulSoup
import re

with open("real_bicsa_page.html", "r", encoding="utf-8") as f:
    html = f.read()

soup = BeautifulSoup(html, "html.parser")

categories = [
    "Activa",
    "Suspendida",
    "Bloqueada",
    "Con excepción de carga",
    "Desvinculada",
    "Validación de XML",
    "Activa (límite de consultas)"
]

print(f"Buscando tablas en real_bicsa_page.html...")
tables = soup.find_all("table")
print(f"Total tablas encontradas: {len(tables)}")

results = []

for idx, table in enumerate(tables):
    rows = table.find_all("tr")
    if len(rows) <= 1:
        continue

    # Determinar categoría inspeccionando elementos hermanos anteriores o padres
    categoria_detectada = None
    
    # 1. Buscar en id o class de la tabla
    table_id = table.get("id", "")
    table_class = " ".join(table.get("class", []))
    
    # 2. Buscar texto relevante antes de la tabla
    curr = table
    for _ in range(10):
        curr = curr.previous_element
        if not curr:
            break
        text = getattr(curr, "text", "") or ""
        if text and len(text.strip()) < 100:
            for cat in categories:
                if cat.lower() in text.lower():
                    categoria_detectada = cat
                    break
        if categoria_detectada:
            break

    if not categoria_detectada:
        # Asignación de fallback por orden de tablas si se conoce
        # Tablas 4: Activa, 5: Suspendida, 6: Bloqueada, 7: Con excepción, 8: Desvinculada, 9: Validación XML, 10: Activa límite
        mapping = {
            4: "Activa",
            5: "Suspendida",
            6: "Bloqueada",
            7: "Con excepción de carga",
            8: "Desvinculada",
            9: "Validación de XML",
            10: "Activa (límite de consultas)"
        }
        categoria_detectada = mapping.get(idx + 1, "Desconocido")

    headers = [th.get_text(strip=True) for th in rows[0].find_all(["th", "td"])]
    
    inst_count = 0
    for row in rows[1:]:
        cols = row.find_all("td")
        if not cols:
            continue
        
        row_texts = [c.get_text(strip=True) for c in cols]
        
        # Limpiar columnas vacías de botones "Modificar"
        if len(row_texts) > 1 and row_texts[0] == "":
            row_texts = row_texts[1:]

        if len(row_texts) < 2:
            continue

        nombre = row_texts[0]
        # El campo estado suele ser el segundo elemento
        estado = categoria_detectada
        
        # Limpiar texto del estado si contiene la lista concatenada del dropdown
        if len(row_texts) > 1 and row_texts[1] and len(row_texts[1]) < 30 and not "ActivaSuspendida" in row_texts[1]:
            estado = row_texts[1]

        cant_max = 0
        fecha_carga = None
        calidad = "N.A"
        motivo = None
        vencimiento = None

        for val in row_texts[1:]:
            # Si es fecha
            if re.match(r"\d{2}/\d{2}/\d{4}", val):
                fecha_carga = val
            elif val.upper() in ["ALTA", "BAJA", "N/A", "N.A"]:
                calidad = val
            elif val.isdigit() and int(val) > 0:
                cant_max = int(val)
            elif "Gestión" in val or "Cese" in val or "Falta" in val or "Inconsistencia" in val:
                motivo = val

        results.append({
            "tabla": idx + 1,
            "categoria": categoria_detectada,
            "nombre": nombre,
            "estado": estado,
            "cant_max": cant_max,
            "fecha_carga": fecha_carga,
            "calidad": calidad,
            "motivo": motivo
        })
        inst_count += 1

    print(f"Tabla {idx+1}: {inst_count} instituciones extraídas. Categoría: {categoria_detectada}")

print(f"\nTotal Instituciones Reales Extraídas: {len(results)}")
print("\nMuestra de instituciones reales:")
for r in results[:10]:
    print(f" - [{r['categoria']}] {r['nombre']} | Carga: {r['fecha_carga']} | Calidad: {r['calidad']}")
