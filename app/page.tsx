// @ts-nocheck
"use client";

import { useState, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const CAR_BRANDS = [
  "Alfa Romeo",
  "Audi",
  "BAIC",
  "BMW",
  "BYD",
  "Changan",
  "Chery",
  "Chevrolet",
  "Citroën",
  "Dodge",
  "Fiat",
  "Ford",
  "Great Wall",
  "Honda",
  "Hyundai",
  "JAC",
  "Jeep",
  "Kia",
  "Land Rover",
  "Lexus",
  "Mazda",
  "Mercedes-Benz",
  "Mitsubishi",
  "Nissan",
  "Opel",
  "Peugeot",
  "Renault",
  "SsangYong",
  "Subaru",
  "Suzuki",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
].sort();

const currencyFormat = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const parseNumber = (value: string) => {
  if (!value) return 0;
  const n = Number(String(value).replace(/\./g, "").replace(/,/g, "."));
  return isNaN(n) ? 0 : n;
};

const parseQuantity = (value: string) => {
  if (!value || value.trim() === "") return 1;
  return parseNumber(value);
};

// Helper para convertir el logo a dataURL para el PDF
function loadImageAsDataURL(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg");
      resolve(dataUrl);
    };
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

type Item = {
  description: string;
  unitPrice: string;
  quantity: string;
};

type Category = {
  key: string;
  label: string;
  items: Item[];
};

export default function Home() {
  const [clientData, setClientData] = useState({
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    vehicleBrand: "",
    vehicleModel: "",
    vehicleYear: "",
    vehicleMileage: "",
    plate: "",
  });

  const emptyItem: Item = {
    description: "",
    unitPrice: "",
    quantity: "1",
  };

  const [categories, setCategories] = useState<Category[]>([
    {
      key: "repuestos",
      label: "Repuestos",
      items: [emptyItem],
    },
    {
      key: "mano_obra",
      label: "Mano de obra",
      items: [emptyItem],
    },
    {
      key: "insumos",
      label: "Insumos",
      items: [emptyItem],
    },
  ]);

  const handleClientChange = (field: string, value: string) => {
    setClientData((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (
    catKey: string,
    index: number,
    field: keyof Item,
    value: string
  ) => {
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.key !== catKey) return cat;
        const newItems = [...cat.items];
        newItems[index] = { ...newItems[index], [field]: value };
        return { ...cat, items: newItems };
      })
    );
  };

  const addItemRow = (catKey: string) => {
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.key !== catKey) return cat;
        return { ...cat, items: [...cat.items, { ...emptyItem }] };
      })
    );
  };

  const removeItemRow = (catKey: string, index: number) => {
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.key !== catKey) return cat;
        const newItems = cat.items.filter((_, i) => i !== index);
        return {
          ...cat,
          items: newItems.length ? newItems : [{ ...emptyItem }],
        };
      })
    );
  };

  // Cálculo de bases, IVA (solo mano de obra) y subtotales
  const { baseSubtotals, ivaByCategory, subtotals } = useMemo(() => {
    const baseSubtotals: Record<string, number> = {};
    const ivaByCategory: Record<string, number> = {};
    const subtotals: Record<string, number> = {};

    categories.forEach((cat) => {
      const base = cat.items.reduce((sum, item) => {
        const price = parseNumber(item.unitPrice);
        const qty = parseQuantity(item.quantity);
        return sum + price * qty;
      }, 0);

      baseSubtotals[cat.key] = base;

      const iva = cat.key === "mano_obra" ? Math.round(base * 0.19) : 0;

      ivaByCategory[cat.key] = iva;
      subtotals[cat.key] = base + iva;
    });

    return { baseSubtotals, ivaByCategory, subtotals };
  }, [categories]);

  const total = useMemo(
    () => Object.values(subtotals).reduce((sum, val) => sum + val, 0),
    [subtotals]
  );

  // ========= PDF =========
  const generatePdf = async () => {
    const doc = new jsPDF();

    const leftMargin = 14;
    const rightMargin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();

    const titleY = 20;

    // Logo con márgenes simétricos
    try {
      const logoDataUrl = await loadImageAsDataURL("/logo-jmc.jpg");
      const imgProps = (doc as any).getImageProperties(logoDataUrl);
      const logoWidth = 40;
      const logoHeight = (imgProps.height * logoWidth) / imgProps.width;
      const logoX = pageWidth - rightMargin - logoWidth;
      const logoY = titleY - logoHeight / 2;
      doc.addImage(logoDataUrl, "JPEG", logoX, logoY, logoWidth, logoHeight);
    } catch (error) {
      console.error("No se pudo cargar el logo para el PDF", error);
    }

    // Título
    doc.setFontSize(18);
    doc.setFont(undefined, "normal");
    doc.text("JMC Repair", leftMargin, titleY);
    doc.setFontSize(11);
    doc.text("Presupuesto de servicios mecánicos", leftMargin, titleY + 7);

    // Datos del cliente en tabla
    const clientRows = [
      ["Cliente", clientData.clientName || "-"],
      ["Teléfono", clientData.clientPhone || "-"],
      ["Email", clientData.clientEmail || "-"],
      [
        "Vehículo",
        `${clientData.vehicleBrand || "-"} ${
          clientData.vehicleModel || ""
        }`.trim(),
      ],
      ["Año", clientData.vehicleYear || "-"],
      [
        "Kilometraje",
        clientData.vehicleMileage ? `${clientData.vehicleMileage} km` : "-",
      ],
      ["Patente", clientData.plate || "-"],
    ];

    autoTable(doc, {
      startY: 42,
      head: [["Dato", "Información"]],
      body: clientRows,
      theme: "grid",
      styles: {
        fontSize: 7,
        cellPadding: 1.2,
      },
      headStyles: {
        fillColor: [230, 230, 230],
        textColor: 0,
        fontSize: 7,
      },
      margin: { left: leftMargin, right: rightMargin },
      tableWidth: "auto",
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: pageWidth - leftMargin - rightMargin - 35 },
      },
    });

    let currentY = (doc as any).lastAutoTable.finalY + 6;

    // Categorías e ítems
    categories.forEach((cat) => {
      // Título de la categoría
      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      doc.text(cat.label, leftMargin, currentY);
      currentY += 4;

      const body = cat.items.map((item) => {
        const price = parseNumber(item.unitPrice);
        const qty = parseQuantity(item.quantity);
        const lineTotal = price * qty;

        return [
          item.description || "",
          price ? currencyFormat.format(price) : "",
          qty || "",
          lineTotal ? currencyFormat.format(lineTotal) : "",
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [["Descripción", "V. unitario", "Cant.", "Monto"]],
        body,
        theme: "grid",
        styles: {
          fontSize: 7,
          cellPadding: 1.2,
        },
        headStyles: {
          fillColor: [230, 230, 230],
          textColor: 0,
          fontSize: 7,
        },
        margin: { left: leftMargin, right: rightMargin },
        tableWidth: "auto",
        columnStyles: {
          0: { cellWidth: pageWidth - leftMargin - rightMargin - 60 },
          1: { cellWidth: 20 },
          2: { cellWidth: 15 },
          3: { cellWidth: 25 },
        },
      });

      const lastTable = (doc as any).lastAutoTable;
      if (lastTable && lastTable.finalY) {
        currentY = lastTable.finalY + 4;
      } else {
        currentY += 10;
      }

      // Subtotales / IVA con tamaño de texto igual a la tabla y en negrita
      doc.setFontSize(7);
      doc.setFont(undefined, "bold");

      if (cat.key === "mano_obra") {
        const base = baseSubtotals[cat.key] || 0;
        const iva = ivaByCategory[cat.key] || 0;
        const sub = subtotals[cat.key] || 0;

        doc.text(
          `Base Mano de obra: ${currencyFormat.format(base)}`,
          leftMargin,
          currentY
        );
        currentY += 4;

        doc.text(
          `IVA Mano de obra (19%): ${currencyFormat.format(iva)}`,
          leftMargin,
          currentY
        );
        currentY += 4;

        doc.text(
          `Subtotal Mano de obra (IVA incluido): ${currencyFormat.format(sub)}`,
          leftMargin,
          currentY
        );
      } else {
        doc.text(
          `Subtotal ${cat.label}: ${currencyFormat.format(
            subtotals[cat.key] || 0
          )}`,
          leftMargin,
          currentY
        );
      }

      currentY += 8;
    });

    // Total
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text(`TOTAL: ${currencyFormat.format(total)}`, leftMargin, currentY + 4);

    doc.save(
      `presupuesto_${clientData.clientName || "cliente"}_${
        clientData.plate || "vehiculo"
      }.pdf`
    );
  };

  // ========= CSV / "Excel" =========
  const downloadCsv = () => {
    let csv = "Categoría,Descripción,Valor unitario,Cantidad,Monto\n";

    categories.forEach((cat) => {
      cat.items.forEach((item) => {
        const price = parseNumber(item.unitPrice);
        const qty = parseQuantity(item.quantity);
        const lineTotal = price * qty;

        csv += `"${cat.label}","${(item.description || "").replace(
          /"/g,
          '""'
        )}",${price || ""},${qty || ""},${lineTotal || ""}\n`;
      });

      if (cat.key === "mano_obra") {
        csv += `"Base Mano de obra",,,,${baseSubtotals[cat.key] || 0}\n`;
        csv += `"IVA Mano de obra (19%)",,,,${ivaByCategory[cat.key] || 0}\n`;
        csv += `"Subtotal Mano de obra (IVA incluido),,,,${subtotals[
          cat.key
        ] || 0}\n`;
      } else {
        csv += `"Subtotal ${cat.label}",,,,${subtotals[cat.key] || 0}\n`;
      }
    });

    csv += `"TOTAL",,,,${total}\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "presupuesto_jmc.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-md p-6 md:p-8 space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">JMC Repair</h1>
            <p className="text-sm text-slate-500">
              Presupuestos de servicios mecánicos
            </p>
          </div>
          <img
            src="/logo-jmc.jpg"
            alt="JMC Repair"
            className="h-16 object-contain"
          />
        </header>

        {/* Datos cliente / vehículo */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-800">
            Datos del cliente y vehículo
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Nombre cliente</label>
              <input
                className="w-full border rounded-md px-2 py-1 text-sm"
                value={clientData.clientName}
                onChange={(e) =>
                  handleClientChange("clientName", e.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Teléfono</label>
              <input
                className="w-full border rounded-md px-2 py-1 text-sm"
                value={clientData.clientPhone}
                onChange={(e) =>
                  handleClientChange("clientPhone", e.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Email</label>
              <input
                type="email"
                className="w-full border rounded-md px-2 py-1 text-sm"
                value={clientData.clientEmail}
                onChange={(e) =>
                  handleClientChange("clientEmail", e.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Patente</label>
              <input
                className="w-full border rounded-md px-2 py-1 text-sm"
                value={clientData.plate}
                onChange={(e) => handleClientChange("plate", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Marca vehículo</label>
              <select
                className="w-full border rounded-md px-2 py-1 text-sm"
                value={clientData.vehicleBrand}
                onChange={(e) =>
                  handleClientChange("vehicleBrand", e.target.value)
                }
              >
                <option value="">Selecciona una marca</option>
                {CAR_BRANDS.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Modelo vehículo</label>
              <input
                className="w-full border rounded-md px-2 py-1 text-sm"
                value={clientData.vehicleModel}
                onChange={(e) =>
                  handleClientChange("vehicleModel", e.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Año</label>
              <input
                className="w-full border rounded-md px-2 py-1 text-sm"
                value={clientData.vehicleYear}
                onChange={(e) =>
                  handleClientChange("vehicleYear", e.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Kilometraje</label>
              <input
                className="w-full border rounded-md px-2 py-1 text-sm"
                value={clientData.vehicleMileage}
                onChange={(e) =>
                  handleClientChange("vehicleMileage", e.target.value)
                }
              />
            </div>
          </div>
        </section>

        {/* Categorías */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold text-slate-800">
            Detalle del presupuesto
          </h2>

          {categories.map((cat) => (
            <div
              key={cat.key}
              className="border rounded-lg p-4 space-y-3 bg-slate-50"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">{cat.label}</h3>
                <button
                  type="button"
                  onClick={() => addItemRow(cat.key)}
                  className="text-xs px-2 py-1 border rounded-md"
                >
                  + Añadir línea
                </button>
              </div>

              {/* Cabecera visual de columnas */}
              <div className="hidden md:grid grid-cols-12 gap-2 text-[11px] text-slate-500 font-semibold">
                <div className="col-span-5">Descripción</div>
                <div className="col-span-2">Valor unitario</div>
                <div className="col-span-2">Cantidad</div>
                <div className="col-span-2">Monto</div>
                <div className="col-span-1" />
              </div>

              <div className="space-y-2">
                {cat.items.map((item, index) => {
                  const price = parseNumber(item.unitPrice);
                  const qty = parseQuantity(item.quantity);
                  const lineTotal = price * qty;

                  return (
                    <div
                      key={index}
                      className="grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-12 md:col-span-5">
                        <input
                          className="w-full border rounded-md px-2 py-1 text-sm"
                          placeholder="Descripción"
                          value={item.description}
                          onChange={(e) =>
                            handleItemChange(
                              cat.key,
                              index,
                              "description",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <input
                          className="w-full border rounded-md px-2 py-1 text-sm text-right"
                          placeholder="Valor unitario"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleItemChange(
                              cat.key,
                              index,
                              "unitPrice",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <div className="col-span-3 md:col-span-2">
                        <input
                          className="w-full border rounded-md px-2 py-1 text-sm text-right"
                          placeholder="Cant."
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(
                              cat.key,
                              index,
                              "quantity",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <div className="col-span-2 md:col-span-2">
                        <input
                          className="w-full border rounded-md px-2 py-1 text-sm text-right bg-slate-100"
                          readOnly
                          placeholder="Monto"
                          value={
                            lineTotal > 0 ? currencyFormat.format(lineTotal) : ""
                          }
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeItemRow(cat.key, index)}
                          className="text-xs text-red-500"
                        >
                          X
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Subtotales e IVA en la vista web */}
              <div className="flex justify-end">
                {cat.key === "mano_obra" ? (
                  <div className="text-right text-xs font-semibold text-slate-700">
                    <p>
                      Base Mano de obra:{" "}
                      {currencyFormat.format(baseSubtotals[cat.key] || 0)}
                    </p>
                    <p>
                      IVA Mano de obra (19%):{" "}
                      {currencyFormat.format(ivaByCategory[cat.key] || 0)}
                    </p>
                    <p>
                      Subtotal Mano de obra (IVA incluido):{" "}
                      {currencyFormat.format(subtotals[cat.key] || 0)}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-slate-700">
                    Subtotal {cat.label}:{" "}
                    {currencyFormat.format(subtotals[cat.key] || 0)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* Total + botones */}
        <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-lg font-bold text-slate-900">
              TOTAL: {currencyFormat.format(total)}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={downloadCsv}
              className="px-4 py-2 text-sm border rounded-md"
            >
              Descargar Excel (CSV)
            </button>
            <button
              type="button"
              onClick={generatePdf}
              className="px-4 py-2 text-sm rounded-md bg-slate-800 text-white"
            >
              Generar PDF
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
