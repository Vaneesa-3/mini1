let shuffleIndex = 0;

const classrooms = ["SH", "6A", "7A", "8A", "9A"];

const odd  = ["S1", "S3", "S5", "S7"];
const even = ["S2", "S4", "S6", "S8"];

let selectedClasses = [];
let roomCaps        = {};
let studentTotals   = {};

const classroomDiv = document.getElementById("classrooms");

classrooms.forEach(room => {
  let div = document.createElement("div");
  div.className = "classroom";
  div.innerHTML = `<label>${room}</label>
<input type="checkbox" onchange="toggleCapacity(this,'${room}')">`;
  classroomDiv.appendChild(div);
});


function toggleCapacity(cb, room) {
  let checked = document.querySelectorAll("#classrooms input[type=checkbox]:checked");
  if (checked.length > 4) {
    cb.checked = false;
    alert("Only 4 classrooms allowed");
    return;
  }
  let parent = cb.parentElement;
  if (cb.checked) {
    let input = document.createElement("input");
    input.type = "number";
    input.placeholder = "capacity";
    input.className = "capacity";
    input.id = "cap_" + room;
    parent.appendChild(input);
  } else {
    let cap = document.getElementById("cap_" + room);
    if (cap) cap.remove();
  }
}


function loadStudentClasses() {
  let sem = document.querySelector("input[name=sem]:checked").value;
  let classes = sem === "odd" ? odd : even;
  let container = document.getElementById("studentClasses");
  container.innerHTML = "";
  classes.forEach(c => {
    let div = document.createElement("div");
    div.innerHTML = `<input type="checkbox" value="${c}"> ${c}`;
    container.appendChild(div);
  });
}

loadStudentClasses();

document.querySelectorAll("input[name=sem]").forEach(r => {
  r.addEventListener("change", loadStudentClasses);
});


function confirmClasses() {
  let checks = document.querySelectorAll("#studentClasses input:checked");
  selectedClasses = [];
  checks.forEach(c => selectedClasses.push(c.value));
  if (selectedClasses.length === 0) {
    alert("Select student classes");
    return;
  }
  let container = document.getElementById("studentClasses");
  container.innerHTML = "";
  selectedClasses.forEach(c => {
    let div = document.createElement("div");
    div.innerHTML = `${c} <input type="number" id="stu_${c}" placeholder="students">`;
    container.appendChild(div);
  });
  let btn = document.createElement("button");
  btn.innerText = "Generate Seating";
  btn.onclick = () => {
    shuffleIndex = 0;
    generateSeating(false);
  };
  container.appendChild(btn);
}


function computeAllocation(rooms, caps, totals, classes, si) {
  let numClasses = classes.length;
  let allocation = {};
  rooms.forEach(r => {
    allocation[r] = {};
    classes.forEach(cls => { allocation[r][cls] = 0; });
  });
  classes.forEach(cls => {
    let total          = totals[cls];
    let startRoomIndex = si % rooms.length;
    let circularRooms  = [];
    for (let i = 0; i < rooms.length; i++) {
      circularRooms.push(rooms[(startRoomIndex + i) % rooms.length]);
    }
    let remaining = total;
    circularRooms.forEach((room, idx) => {
      let perRoom = Math.floor(caps[room] / numClasses);
      let give;
      if (idx < circularRooms.length - 1) {
        give = Math.min(perRoom, remaining);
      } else {
        give = remaining;
      }
      allocation[room][cls] = give;
      remaining -= give;
    });
  });
  return allocation;
}


function generateSeating(isShuffle = false) {
  roomCaps = {};
  classrooms.forEach(r => {
    let cap = document.getElementById("cap_" + r);
    if (cap && cap.value) roomCaps[r] = parseInt(cap.value);
  });
  let rooms = Object.keys(roomCaps);
  if (rooms.length !== 4) {
    alert("Select 4 classrooms with capacity");
    return;
  }
  studentTotals = {};
  selectedClasses.forEach(c => {
    let el = document.getElementById("stu_" + c);
    studentTotals[c] = parseInt(el.value) || 0;
  });
  let allocation = computeAllocation(
    rooms, roomCaps, studentTotals, selectedClasses, shuffleIndex
  );
  displayResult(allocation, rooms, shuffleIndex, isShuffle, false);
}


function displayResult(data, rooms, si, isReplace, forceAppend) {

  let blockSI     = si;
  let snapRooms   = [...rooms];
  let snapCaps    = Object.assign({}, roomCaps);
  let snapTotals  = Object.assign({}, studentTotals);
  let snapClasses = [...selectedClasses];

  let block = document.createElement("div");
  block.className = "arrangementBlock";

  let info = document.createElement("div");
  info.className = "info";
  info.innerHTML = `
    <label>Date:</label>
    <input type="text" placeholder="Enter date">
    &nbsp;&nbsp;
    <label>Time:</label>
    <input type="text" placeholder="FN / AN / FN & AN">
  `;
  block.appendChild(info);

  let tableWrapper = document.createElement("div");
  block.appendChild(tableWrapper);

  function buildTable(allocation, currentSI) {
    let tbl = document.createElement("table");
    let header = "<tr><th>Class</th>";
    snapRooms.forEach(room => { header += `<th>${room}</th>`; });
    header += "</tr>";
    tbl.innerHTML = header;

    snapClasses.forEach(cls => {
      let startIdx  = currentSI % snapRooms.length;
      let circRooms = [];
      for (let i = 0; i < snapRooms.length; i++) {
        circRooms.push(snapRooms[(startIdx + i) % snapRooms.length]);
      }
      let roomStart = {};
      let cursor = 1;
      circRooms.forEach(room => {
        roomStart[room] = cursor;
        cursor += allocation[room][cls];
      });
      let row = `<tr><td>${cls}</td>`;
      snapRooms.forEach(room => {
        let count = allocation[room][cls];
        if (!count || count === 0) {
          row += `<td>-</td>`;
        } else {
          let start = roomStart[room];
          let end   = start + count - 1;
          row += `<td>${start}-${end}</td>`;
        }
      });
      row += "</tr>";
      tbl.innerHTML += row;
    });

    let seatRow = "<tr><td><b>Seats</b></td>";
    snapRooms.forEach((room, index) => {
      let seatText = "";
      if (room === "SH") {
        snapClasses.forEach((cls, i) => { seatText += `C${i+1}(${cls}:10), `; });
        snapClasses.forEach((cls, i) => { seatText += `C${i+4}(${cls}:7), `;  });
      } else if (index < snapRooms.length - 1) {
        snapClasses.forEach((cls, i) => { seatText += `C${i+1}(${cls}:8), `; });
        snapClasses.forEach((cls, i) => { seatText += `C${i+4}(${cls}:8), `; });
        snapClasses.forEach((cls, i) => { seatText += `C${i+7}(${cls}:5), `; });
      } else {
        snapClasses.forEach((cls, i) => {
          let count  = allocation[room][cls];
          let first  = 8, second = 8;
          let third  = count - first - second;
          seatText += `C${i+1}(${cls}:${first}), `;
          seatText += `C${i+4}(${cls}:${second}), `;
          seatText += `C${i+7}(${cls}:${third > 0 ? third : 0}), `;
        });
      }
      seatRow += `<td>${seatText}</td>`;
    });
    seatRow += "</tr>";
    tbl.innerHTML += seatRow;
    return tbl;
  }

  tableWrapper.appendChild(buildTable(data, blockSI));

  let btnDiv = document.createElement("div");
  btnDiv.className = "blockBtns";
  btnDiv.style.marginTop = "10px";

  let shuffleBtn = document.createElement("button");
  shuffleBtn.innerText = "Shuffle";
  shuffleBtn.onclick = () => {
    blockSI++;
    let newAlloc = computeAllocation(snapRooms, snapCaps, snapTotals, snapClasses, blockSI);
    tableWrapper.innerHTML = "";
    tableWrapper.appendChild(buildTable(newAlloc, blockSI));
  };

  let addMoreBtn = document.createElement("button");
  addMoreBtn.innerText = "Add More";
  addMoreBtn.onclick = () => {
    let cloneAlloc = computeAllocation(snapRooms, snapCaps, snapTotals, snapClasses, blockSI);
    displayResult(cloneAlloc, snapRooms, blockSI, false, true);
  };

  let downloadBtn = document.createElement("button");
  downloadBtn.innerText = "Download PDF";
  downloadBtn.onclick = () => downloadBlockAsPDF(block);

  btnDiv.appendChild(shuffleBtn);
  btnDiv.appendChild(addMoreBtn);
  btnDiv.appendChild(downloadBtn);
  block.appendChild(btnDiv);

  let output = document.getElementById("output");

  if (forceAppend) {
    output.appendChild(block);
  } else if (isReplace) {
    let existing = output.querySelectorAll(".arrangementBlock");
    if (existing.length > 0) {
      output.replaceChild(block, existing[existing.length - 1]);
    } else {
      output.appendChild(block);
    }
  } else {
    output.innerHTML = "";
    output.appendChild(block);
  }

  updateDownloadAllBtn();
}


function updateDownloadAllBtn() {
  let output   = document.getElementById("output");
  let existing = document.getElementById("downloadAllBtn");
  if (existing) existing.remove();

  let blocks = output.querySelectorAll(".arrangementBlock");
  if (blocks.length < 2) return;

  let btn = document.createElement("button");
  btn.id        = "downloadAllBtn";
  btn.innerText = "Download All as PDF";
  btn.style.cssText = "display:block; margin: 16px auto 0; padding: 10px 24px; font-size: 15px;";
  btn.onclick   = downloadAllAsPDF;
  output.appendChild(btn);
}


/* ── Shared script loader ─────────────────────────────────────────────── */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    let existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") { resolve(); return; }
      existing.addEventListener("load", resolve);
      existing.addEventListener("error", reject);
      return;
    }
    let s = document.createElement("script");
    s.src = src;
    s.onload  = () => { s.dataset.loaded = "true"; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}


/* ── THE CORE FIX: clone each block into a fresh off-screen container ───
   Instead of capturing the live scrollable DOM (which can be clipped,
   partially off-screen, or affected by visibility toggling), we:
     1. Deep-clone the block
     2. Place it in a position:fixed off-screen div (z-index:-9999)
     3. Capture THAT clone — it's always fully in layout, fully painted
     4. Remove the clone immediately after capture
   This eliminates ALL scroll/visibility/race issues in one shot.        */
function captureBlockAsCanvas(block) {
  return new Promise((resolve, reject) => {

    // Build off-screen container
    let wrap = document.createElement("div");
    wrap.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "width:" + Math.max(document.body.offsetWidth, 900) + "px",
      "background:#ffffff",
      "z-index:-9999",
      "pointer-events:none",
      "padding:15px",
      "box-sizing:border-box"
    ].join(";");

    // Clone block, hide buttons inside clone
    let clone = block.cloneNode(true);
    clone.querySelectorAll(".blockBtns").forEach(b => b.style.display = "none");
    wrap.appendChild(clone);
    document.body.appendChild(wrap);

    // Two rAF cycles ensure layout is computed, then capture
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          html2canvas(wrap, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            scrollX: 0,
            scrollY: 0,
            windowWidth:  wrap.offsetWidth,
            windowHeight: wrap.scrollHeight
          })
          .then(canvas => {
            document.body.removeChild(wrap);
            resolve(canvas);
          })
          .catch(err => {
            document.body.removeChild(wrap);
            reject(err);
          });
        }, 120);
      });
    });
  });
}


/* ── Download ALL blocks — one page per block ────────────────────────── */
function downloadAllAsPDF() {

  const resultSection = document.querySelector(".section.result");
  if (!resultSection) return;

  const btn = document.getElementById("downloadAllBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Generating PDF...";
  }

  Promise.all([
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"),
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js")
  ])
  .then(() => {

    return html2canvas(resultSection, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff"
    });

  })
  .then(canvas => {

    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const imgW = pageW - 20;
    const imgH = (canvas.height * imgW) / canvas.width;

    const imgData = canvas.toDataURL("image/png");

    if (imgH <= pageH - 20) {

      pdf.addImage(imgData, "PNG", 10, 10, imgW, imgH);

    } else {

      let position = 0;
      const pageCanvasHeight = (canvas.width * (pageH - 20)) / imgW;

      while (position < canvas.height) {

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = pageCanvasHeight;

        const ctx = pageCanvas.getContext("2d");

        ctx.drawImage(
          canvas,
          0, position,
          canvas.width, pageCanvasHeight,
          0, 0,
          canvas.width, pageCanvasHeight
        );

        const pageImg = pageCanvas.toDataURL("image/png");

        pdf.addImage(pageImg, "PNG", 10, 10, imgW, pageH - 20);

        position += pageCanvasHeight;

        if (position < canvas.height) pdf.addPage();
      }
    }

    pdf.save("all-seating-arrangements.pdf");

  })
  .catch(err => {
    alert("PDF generation failed: " + err.message);
  })
  .finally(() => {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Download All as PDF";
    }
  });

}


/* ── Single block PDF download ───────────────────────────────────────── */
function downloadBlockAsPDF(block) {
  Promise.all([
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"),
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js")
  ])
  .then(() => captureBlockAsCanvas(block))
  .then(canvas => {
    const { jsPDF } = window.jspdf;
    const pdf     = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW   = pdf.internal.pageSize.getWidth();
    const pageH   = pdf.internal.pageSize.getHeight();
    const margin  = 10;
    const imgW    = pageW - margin * 2;
    const imgH    = (canvas.height * imgW) / canvas.width;
    const imgData = canvas.toDataURL("image/png");
    if (imgH <= pageH - margin * 2) {
      pdf.addImage(imgData, "PNG", margin, margin, imgW, imgH);
    } else {
      const scaledH = pageH - margin * 2;
      const scaledW = (canvas.width * scaledH) / canvas.height;
      pdf.addImage(imgData, "PNG", margin, margin, scaledW, scaledH);
    }
    let dateInput = block.querySelector("input[placeholder='Enter date']");
    let dateVal   = dateInput && dateInput.value.trim() ? dateInput.value.trim() : Date.now();
    pdf.save(`seating-${dateVal}.pdf`);
  })
  .catch(err => alert("PDF generation failed: " + err.message));
}
