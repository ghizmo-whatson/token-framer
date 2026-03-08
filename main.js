(() => {
  const LANG = {
    RU: "ru",
    EN: "en",
  };

  const MODES = {
    OFFSET: "offset",
    MASK: "mask",
  };

  const BRUSH_MODES = {
    COLOR: "color",
    LOCAL: "local",
    ERASER: "eraser",
  };

  const SIDE = {
    TOKEN: "token",
    FRAME: "frame",
  };

  const I18N = {
    ru: {
      title: "Image + Frame Mixer",
      paste: "Вставить из буфера",
      undo: "Откатить изменения",
      download: "Скачать",
      removeToken: "Кисть удаления на токене",
      removeFrame: "Кисть удаления на рамке",
      modeColor: "Удаление цвета",
      modeLocal: "Локальная очистка цвета",
      modeEraser: "Ластик",
      placeholderToken: "Перетащите сюда изображение",
      placeholderFrame: "Перетащите сюда рамку",
      placeholderPreview:
        "Здесь появится результат\n\nПосле загрузки рамки можно двигать изображение мышью в центре.",
      centerModeLabel: "Режим",
      centerScaleLabel: "Масштаб",
      centerTokenScaleLabel: "Масштаб токена",
      modeOffset: "Смещение",
      modeMask: "Маска",
      tokenScalePrefix: "Токен",
      brushPurple: "Фиолетовая кисть: {size}",
      brushRed: "Красная кисть: {size}",
      brushMain: "Кисть: {size}",
      alertBadImage: "Файл не удалось открыть как изображение.",
      alertClipboardPermission: "Браузер не дал доступ к буферу через кнопку. Нажмите сейчас Cmd/Ctrl+V.",
      alertPastedUnreadable: "Вставленное содержимое не удалось прочитать как изображение.",
      alertClipboardNoImage: "В буфере нет изображения для вставки.",
      alertSaveFailed: "Не удалось сохранить изображение.",
      tipLangSelect: "Переключает язык интерфейса приложения.",
      tipPasteToken: "Вставляет изображение из буфера обмена в левое окно токена.",
      tipUndoToken: "Сбрасывает все правки токена: удаление цвета и ластик.",
      tipRemoveTokenCheck: "Включает инструменты очистки для токена и показ кистей.",
      tipTokenModeColor:
        "Удаляет выбранные цвета по всему токену; правая кнопка мыши отменяет действие и возвращает удаленные цвета.",
      tipTokenModeLocal:
        "Удаляет цвета только в области фиолетовой кисти по цветам из красной кисти; правая кнопка мыши отменяет действие и возвращает удаленные цвета.",
      tipTokenModeEraser:
        "Стирает части токена кистью; правая кнопка мыши отменяет действие и возвращает стертые участки.",
      tipCenterMode:
        "Переключает центральный режим: 'Смещение' для выравнивания токена относительно рамки и 'Маска' для рисования дополнительного верхнего слоя токена поверх рамки (левая кнопка рисует, правая стирает маску).",
      tipCenterScale: "Меняет размер финального холста, добавляя или убирая поля вокруг рамки.",
      tipTokenScale: "Меняет масштаб токена в центральной композиции.",
      tipDownload: "Сохраняет текущий результат как PNG-файл.",
      tipPasteFrame: "Вставляет изображение из буфера обмена в правое окно рамки.",
      tipUndoFrame: "Сбрасывает все правки рамки: удаление цвета и ластик.",
      tipRemoveFrameCheck: "Включает инструменты очистки для рамки и показ кистей.",
      tipFrameModeColor:
        "Удаляет выбранные цвета по всей рамке; правая кнопка мыши отменяет действие и возвращает удаленные цвета.",
      tipFrameModeLocal:
        "Удаляет цвета только в области фиолетовой кисти по цветам из красной кисти; правая кнопка мыши отменяет действие и возвращает удаленные цвета.",
      tipFrameModeEraser:
        "Стирает части рамки кистью; правая кнопка мыши отменяет действие и возвращает стертые участки.",
    },
    en: {
      title: "Image + Frame Mixer",
      paste: "Paste from Clipboard",
      undo: "Undo Changes",
      download: "Download",
      removeToken: "Token Removal Brush",
      removeFrame: "Frame Removal Brush",
      modeColor: "Color Removal",
      modeLocal: "Local Color Cleanup",
      modeEraser: "Eraser",
      placeholderToken: "Drag image here",
      placeholderFrame: "Drag frame here",
      placeholderPreview: "The result will appear here\n\nAfter loading a frame, drag the image in the center.",
      centerModeLabel: "Mode",
      centerScaleLabel: "Scale",
      centerTokenScaleLabel: "Token Scale",
      modeOffset: "Offset",
      modeMask: "Mask",
      tokenScalePrefix: "Token",
      brushPurple: "Purple Brush: {size}",
      brushRed: "Red Brush: {size}",
      brushMain: "Brush: {size}",
      alertBadImage: "The file could not be opened as an image.",
      alertClipboardPermission: "Browser access to clipboard is blocked for button click. Press Cmd/Ctrl+V now.",
      alertPastedUnreadable: "Pasted content could not be read as an image.",
      alertClipboardNoImage: "There is no image in the clipboard.",
      alertSaveFailed: "Failed to save image.",
      tipLangSelect: "Switches the application interface language.",
      tipPasteToken: "Pastes an image from clipboard into the left token panel.",
      tipUndoToken: "Resets all token edits: color removal and eraser strokes.",
      tipRemoveTokenCheck: "Enables token cleanup tools and brush overlays.",
      tipTokenModeColor:
        "Removes selected colors globally across the token image; right mouse button inverts the action and restores removed colors.",
      tipTokenModeLocal:
        "Removes colors only inside the purple brush area using colors sampled by the red brush; right mouse button inverts the action and restores removed colors.",
      tipTokenModeEraser:
        "Erases token parts with the brush; right mouse button inverts the action and restores erased areas.",
      tipCenterMode:
        "Switches center mode between 'Offset' (align token relative to frame) and 'Mask' (paint an extra top token layer over the frame; left button paints, right button erases mask).",
      tipCenterScale: "Changes final canvas size by adding or reducing margins around the frame.",
      tipTokenScale: "Changes token scale in the center composition.",
      tipDownload: "Saves the current result as a PNG file.",
      tipPasteFrame: "Pastes an image from clipboard into the right frame panel.",
      tipUndoFrame: "Resets all frame edits: color removal and eraser strokes.",
      tipRemoveFrameCheck: "Enables frame cleanup tools and brush overlays.",
      tipFrameModeColor:
        "Removes selected colors globally across the frame image; right mouse button inverts the action and restores removed colors.",
      tipFrameModeLocal:
        "Removes colors only inside the purple brush area using colors sampled by the red brush; right mouse button inverts the action and restores removed colors.",
      tipFrameModeEraser:
        "Erases frame parts with the brush; right mouse button inverts the action and restores erased areas.",
    },
  };

  const state = {
    language: LANG.RU,
    appMode: MODES.OFFSET,
    scalePercent: 100,
    tokenScalePercent: 100,
    pendingPasteTarget: null,
    sides: {
      token: {
        source: null,
        masks: {
          color: null,
          local: null,
          eraser: null,
        },
        enabled: false,
        brushMode: BRUSH_MODES.COLOR,
        brushSize: 30,
        localBrushSize: 15,
        viewport: {
          zoom: 1,
          panX: 0,
          panY: 0,
          displayRect: null,
          displayScale: 1,
        },
        paint: {
          active: false,
          draggingPan: false,
          lastX: 0,
          lastY: 0,
          lastMouseX: 0,
          lastMouseY: 0,
        },
      },
      frame: {
        source: null,
        masks: {
          color: null,
          local: null,
          eraser: null,
        },
        enabled: false,
        brushMode: BRUSH_MODES.COLOR,
        brushSize: 30,
        localBrushSize: 15,
        viewport: {
          zoom: 1,
          panX: 0,
          panY: 0,
          displayRect: null,
          displayScale: 1,
        },
        paint: {
          active: false,
          draggingPan: false,
          lastX: 0,
          lastY: 0,
          lastMouseX: 0,
          lastMouseY: 0,
        },
        assets: {
          overlay: null,
          windowMask: null,
        },
      },
    },
    center: {
      userMask: null,
      composed: null,
      baseOffsetX: 0,
      baseOffsetY: 0,
      brushSize: 30,
      draggingOffset: false,
      paintingMask: false,
      erasingMask: false,
      lastMouseX: 0,
      lastMouseY: 0,
      lastPaintX: 0,
      lastPaintY: 0,
      displayRect: null,
      displayScale: 1,
      zoom: 1,
      panX: 0,
      panY: 0,
    },
  };

  const ui = bindUI();
  applyLanguage();
  const sideControllers = {
    token: createSideController(SIDE.TOKEN),
    frame: createSideController(SIDE.FRAME),
  };
  let layoutRenderScheduled = false;

  setupAppEvents();
  renderAll();

  function bindUI() {
    const tokenDrop = document.getElementById("tokenDrop");
    const frameDrop = document.getElementById("frameDrop");

    return {
      token: {
        drop: tokenDrop,
        canvas: document.getElementById("tokenCanvas"),
        placeholder: tokenDrop.querySelector(".placeholder"),
        cursorMain: document.getElementById("tokenCursorOverlay"),
        cursorSample: document.getElementById("tokenSampleCursorOverlay"),
        removeCheck: document.getElementById("removeTokenColorCheck"),
        brushControls: document.getElementById("tokenBrushControls"),
        brushLabel: document.getElementById("tokenBrushLabel"),
        brushSizeInput: document.getElementById("tokenBrushSize"),
        localBrushLabel: document.getElementById("tokenLocalBrushLabel"),
        localBrushSizeInput: document.getElementById("tokenLocalBrushSize"),
        localSizeRow: document.getElementById("tokenLocalSizeRow"),
        undoBtn: document.getElementById("undoTokenBtn"),
        modeInputs: document.querySelectorAll('input[name="tokenBrushMode"]'),
        pasteBtn: document.getElementById("pasteTokenBtn"),
      },
      frame: {
        drop: frameDrop,
        canvas: document.getElementById("frameCanvas"),
        placeholder: frameDrop.querySelector(".placeholder"),
        cursorMain: document.getElementById("frameCursorOverlay"),
        cursorSample: document.getElementById("frameSampleCursorOverlay"),
        removeCheck: document.getElementById("removeFrameColorCheck"),
        brushControls: document.getElementById("frameBrushControls"),
        brushLabel: document.getElementById("frameBrushLabel"),
        brushSizeInput: document.getElementById("frameBrushSize"),
        localBrushLabel: document.getElementById("frameLocalBrushLabel"),
        localBrushSizeInput: document.getElementById("frameLocalBrushSize"),
        localSizeRow: document.getElementById("frameLocalSizeRow"),
        undoBtn: document.getElementById("undoFrameBtn"),
        modeInputs: document.querySelectorAll('input[name="frameBrushMode"]'),
        pasteBtn: document.getElementById("pasteFrameBtn"),
      },
      center: {
        modeSelect: document.getElementById("modeSelect"),
        scaleSelect: document.getElementById("scaleSelect"),
        tokenScaleSelect: document.getElementById("tokenScaleSelect"),
        brushControls: document.getElementById("brushControls"),
        brushLabel: document.getElementById("brushLabel"),
        brushSizeInput: document.getElementById("brushSize"),
        wrap: document.getElementById("previewWrap"),
        canvas: document.getElementById("previewCanvas"),
        placeholder: document.getElementById("previewPlaceholder"),
        cursor: document.getElementById("cursorOverlay"),
        downloadBtn: document.getElementById("downloadBtn"),
      },
      app: {
        title: document.getElementById("appTitle"),
        langSelect: document.getElementById("langSelect"),
        pasteTokenBtn: document.getElementById("pasteTokenBtn"),
        undoTokenBtn: document.getElementById("undoTokenBtn"),
        removeTokenLabel: document.getElementById("removeTokenLabel"),
        tokenModeColorLabel: document.getElementById("tokenModeColorLabel"),
        tokenModeLocalLabel: document.getElementById("tokenModeLocalLabel"),
        tokenModeEraserLabel: document.getElementById("tokenModeEraserLabel"),
        tokenDropPlaceholder: document.getElementById("tokenDropPlaceholder"),
        pasteFrameBtn: document.getElementById("pasteFrameBtn"),
        undoFrameBtn: document.getElementById("undoFrameBtn"),
        removeFrameLabel: document.getElementById("removeFrameLabel"),
        frameModeColorLabel: document.getElementById("frameModeColorLabel"),
        frameModeLocalLabel: document.getElementById("frameModeLocalLabel"),
        frameModeEraserLabel: document.getElementById("frameModeEraserLabel"),
        frameDropPlaceholder: document.getElementById("frameDropPlaceholder"),
        previewPlaceholder: document.getElementById("previewPlaceholder"),
      },
    };
  }

  function createSideController(sideName) {
    const sideState = state.sides[sideName];
    const sideUI = ui[sideName];

    const handlers = {
      onDropFile: async (file) => {
        const image = await readImageFile(file);
        if (!image) {
          alert(t("alertBadImage"));
          return;
        }
        setSource(drawableToCanvas(image));
      },
      onRemoveToggle: () => {
        sideState.enabled = sideUI.removeCheck.checked;
        sideUI.brushControls.classList.toggle("show", sideState.enabled);
        updateLocalSizeVisibility();
        if (!sideState.enabled) {
          sideState.paint.active = false;
          sideState.paint.draggingPan = false;
          hideCursors();
        }
        requestLayoutRender();
      },
      onBrushSizeChange: () => {
        sideState.brushSize = Number(sideUI.brushSizeInput.value);
        updateSideBrushLabels(sideName);
        updateCursorFromLast();
      },
      onLocalBrushSizeChange: () => {
        sideState.localBrushSize = Number(sideUI.localBrushSizeInput.value);
        updateSideBrushLabels(sideName);
        updateCursorFromLast();
      },
      onModeChange: (input) => {
        if (!input.checked) {
          return;
        }
        sideState.brushMode = input.value;
        updateLocalSizeVisibility();
        updateCursorFromLast();
        requestLayoutRender();
      },
      onWheel: (event) => {
        if (!sideState.source) {
          return;
        }
        event.preventDefault();

        const point = toPoint(sideUI.drop, event.clientX, event.clientY);
        const { width, height } = elementSize(sideUI.drop);
        const fit = fitRect(sideState.source.width, sideState.source.height, width - 28, height - 28);
        const oldZoom = sideState.viewport.zoom;
        const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = clamp(oldZoom * zoomFactor, 1, 8);

        if (Math.abs(newZoom - oldZoom) < 0.0001) {
          if (newZoom <= 1.0001 && (sideState.viewport.panX !== 0 || sideState.viewport.panY !== 0)) {
            sideState.viewport.zoom = 1;
            sideState.viewport.panX = 0;
            sideState.viewport.panY = 0;
            renderPreview();
          }
          return;
        }

        const centerX = width / 2;
        const centerY = height / 2;
        const oldDrawW = fit.w * oldZoom;
        const oldDrawH = fit.h * oldZoom;
        const oldX = centerX - oldDrawW / 2 + sideState.viewport.panX;
        const oldY = centerY - oldDrawH / 2 + sideState.viewport.panY;
        const u = (point.x - oldX) / oldDrawW;
        const v = (point.y - oldY) / oldDrawH;
        const newDrawW = fit.w * newZoom;
        const newDrawH = fit.h * newZoom;
        const centeredX = centerX - newDrawW / 2;
        const centeredY = centerY - newDrawH / 2;

        if (newZoom <= 1.0001) {
          sideState.viewport.zoom = 1;
          sideState.viewport.panX = 0;
          sideState.viewport.panY = 0;
        } else {
          sideState.viewport.panX = point.x - centeredX - u * newDrawW;
          sideState.viewport.panY = point.y - centeredY - v * newDrawH;
          sideState.viewport.zoom = newZoom;
        }

        renderPreview();
      },
      onMouseDown: (event) => {
        if (!sideState.source) {
          return;
        }
        if (event.button !== 0 && event.button !== 2) {
          return;
        }

        const point = toPoint(sideUI.drop, event.clientX, event.clientY);
        if (!pointInRect(sideState.viewport.displayRect, point.x, point.y)) {
          return;
        }

        if (!sideState.enabled) {
          if (event.button !== 0) {
            return;
          }
          sideState.paint.draggingPan = true;
          sideState.paint.lastMouseX = point.x;
          sideState.paint.lastMouseY = point.y;
          event.preventDefault();
          return;
        }

        sideState.paint.active = true;
        const imagePoint = widgetToImagePoint(
          sideState.viewport.displayRect,
          effectiveCanvas(sideName)
            ? { width: effectiveCanvas(sideName).width, height: effectiveCanvas(sideName).height }
            : { width: sideState.source.width, height: sideState.source.height },
          point.x,
          point.y
        );

        sideState.paint.lastX = imagePoint.x;
        sideState.paint.lastY = imagePoint.y;
        applyStroke(imagePoint.x, imagePoint.y, imagePoint.x, imagePoint.y, event.button === 2);
        updateCursor(point.x, point.y);
        event.preventDefault();
      },
      onMouseMove: (event) => {
        if (!sideState.source) {
          return;
        }

        const point = toPoint(sideUI.drop, event.clientX, event.clientY);
        const prevMouseX = sideState.paint.lastMouseX;
        const prevMouseY = sideState.paint.lastMouseY;
        sideState.paint.lastMouseX = point.x;
        sideState.paint.lastMouseY = point.y;

        if (sideState.paint.draggingPan && !sideState.enabled) {
          sideState.viewport.panX += point.x - prevMouseX;
          sideState.viewport.panY += point.y - prevMouseY;
          renderPreview();
          return;
        }

        if (sideState.enabled) {
          updateCursor(point.x, point.y);
        } else {
          hideCursors();
        }

        if (!sideState.paint.active || !sideState.enabled) {
          return;
        }
        if (!pointInRect(sideState.viewport.displayRect, point.x, point.y)) {
          return;
        }

        const imagePoint = widgetToImagePoint(
          sideState.viewport.displayRect,
          effectiveCanvas(sideName)
            ? { width: effectiveCanvas(sideName).width, height: effectiveCanvas(sideName).height }
            : { width: sideState.source.width, height: sideState.source.height },
          point.x,
          point.y
        );

        if (imagePoint.x === sideState.paint.lastX && imagePoint.y === sideState.paint.lastY) {
          return;
        }

        applyStroke(
          sideState.paint.lastX,
          sideState.paint.lastY,
          imagePoint.x,
          imagePoint.y,
          (event.buttons & 2) === 2
        );

        sideState.paint.lastX = imagePoint.x;
        sideState.paint.lastY = imagePoint.y;
      },
      onMouseUp: () => {
        sideState.paint.active = false;
        sideState.paint.draggingPan = false;
      },
      onMouseLeave: () => {
        if (!sideState.paint.active) {
          hideCursors();
        }
      },
      onUndo: () => {
        resetMasks();
      },
      onPaste: () => {
        pasteImageTo(sideName);
      },
    };

    bindEvents();

    return {
      setSource,
      renderPreview,
      resetMasks,
      rebuildAssets: rebuildDerivedAssets,
    };

    function bindEvents() {
      setupDropArea(sideUI.drop, handlers.onDropFile);
      sideUI.removeCheck.addEventListener("change", handlers.onRemoveToggle);
      sideUI.brushSizeInput.addEventListener("input", handlers.onBrushSizeChange);
      sideUI.localBrushSizeInput.addEventListener("input", handlers.onLocalBrushSizeChange);
      sideUI.modeInputs.forEach((input) => input.addEventListener("change", () => handlers.onModeChange(input)));
      sideUI.canvas.addEventListener("wheel", handlers.onWheel, { passive: false });
      sideUI.canvas.addEventListener("mousedown", handlers.onMouseDown);
      sideUI.canvas.addEventListener("mousemove", handlers.onMouseMove);
      window.addEventListener("mousemove", handlers.onMouseMove);
      window.addEventListener("mouseup", handlers.onMouseUp);
      sideUI.canvas.addEventListener("mouseleave", handlers.onMouseLeave);
      sideUI.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
      sideUI.undoBtn.addEventListener("click", handlers.onUndo);
      sideUI.pasteBtn.addEventListener("click", handlers.onPaste);
      window.addEventListener("resize", renderPreview);
    }

    function setSource(canvas) {
      sideState.source = canvas;
      sideState.viewport.zoom = 1;
      sideState.viewport.panX = 0;
      sideState.viewport.panY = 0;
      resetMasks(false);
      if (sideName === SIDE.FRAME) {
        rebuildDerivedAssets();
      }
      state.center.baseOffsetX = 0;
      state.center.baseOffsetY = 0;
      state.center.userMask = null;
      renderPreview();
      renderCenterPreview();
    }

    function resetMasks(shouldRender = true) {
      sideState.masks.color = null;
      sideState.masks.local = null;
      sideState.masks.eraser = null;
      if (sideName === SIDE.FRAME) {
        rebuildDerivedAssets();
      }
      if (shouldRender) {
        renderPreview();
        renderCenterPreview();
      }
    }

    function rebuildDerivedAssets() {
      if (sideName !== SIDE.FRAME) {
        return;
      }
      const effective = effectiveCanvas(SIDE.FRAME);
      if (!effective) {
        state.sides.frame.assets.overlay = null;
        state.sides.frame.assets.windowMask = null;
        return;
      }
      const assets = buildFrameAssets(effective);
      state.sides.frame.assets.overlay = assets.overlay;
      state.sides.frame.assets.windowMask = assets.windowMask;
    }

    function renderPreview() {
      const ctx = sideUI.canvas.getContext("2d");
      const { width, height } = elementSize(sideUI.drop);

      if (sideUI.canvas.width !== width || sideUI.canvas.height !== height) {
        sideUI.canvas.width = width;
        sideUI.canvas.height = height;
      }
      ctx.clearRect(0, 0, width, height);

      const image = effectiveCanvas(sideName);
      if (!image) {
        sideUI.placeholder.style.display = "grid";
        sideState.viewport.displayRect = null;
        return;
      }

      sideUI.placeholder.style.display = "none";
      const fit = fitRect(image.width, image.height, width - 28, height - 28);
      const drawW = Math.max(1, Math.floor(fit.w * sideState.viewport.zoom));
      const drawH = Math.max(1, Math.floor(fit.h * sideState.viewport.zoom));
      const drawX = Math.floor((width - drawW) / 2 + sideState.viewport.panX);
      const drawY = Math.floor((height - drawH) / 2 + sideState.viewport.panY);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, drawX, drawY, drawW, drawH);

      sideState.viewport.displayRect = { x: drawX, y: drawY, w: drawW, h: drawH };
      sideState.viewport.displayScale = drawW / image.width;
    }

    function applyStroke(x1, y1, x2, y2, restore) {
      if (!sideState.source) {
        return;
      }

      ensureMasks(sideName);

      if (sideState.brushMode === BRUSH_MODES.COLOR) {
        applyGlobalColorMask(
          sideState.source,
          sideState.masks.color,
          sideState.masks.local,
          sideState.masks.eraser,
          x1,
          y1,
          x2,
          y2,
          sideState.brushSize,
          restore
        );
      } else if (sideState.brushMode === BRUSH_MODES.LOCAL) {
        applyLocalColorMask(
          sideState.source,
          sideState.masks.color,
          sideState.masks.local,
          sideState.masks.eraser,
          x1,
          y1,
          x2,
          y2,
          sideState.brushSize,
          sideState.localBrushSize,
          restore
        );
      } else {
        applyEraserMask(sideState.masks.eraser, x1, y1, x2, y2, sideState.brushSize, restore);
      }

      if (sideName === SIDE.FRAME) {
        rebuildDerivedAssets();
      }

      renderPreview();
      renderCenterPreview();
    }

    function updateLocalSizeVisibility() {
      sideUI.localSizeRow.style.display =
        sideState.enabled && sideState.brushMode === BRUSH_MODES.LOCAL ? "flex" : "none";
    }

    function updateCursorFromLast() {
      const { width, height } = elementSize(sideUI.drop);
      const x = sideState.paint.lastMouseX || width / 2;
      const y = sideState.paint.lastMouseY || height / 2;
      updateCursor(x, y);
    }

    function updateCursor(x, y) {
      if (!sideState.enabled || !sideState.viewport.displayRect) {
        hideCursors();
        return;
      }
      if (!pointInRect(sideState.viewport.displayRect, x, y)) {
        hideCursors();
        return;
      }

      const mainDiameter = Math.max(6, Math.round(sideState.brushSize * sideState.viewport.displayScale));
      placeCursor(sideUI.cursorMain, x, y, mainDiameter, "rgba(160, 80, 255, 0.9)", "rgba(160, 80, 255, 0.35)");

      if (sideState.brushMode === BRUSH_MODES.LOCAL) {
        const sampleDiameter = Math.max(4, Math.round(sideState.localBrushSize * sideState.viewport.displayScale));
        placeCursor(sideUI.cursorSample, x, y, sampleDiameter, "rgba(255, 64, 64, 0.9)", "rgba(255, 64, 64, 0.25)");
      } else {
        hideCursor(sideUI.cursorSample);
      }
    }

    function hideCursors() {
      hideCursor(sideUI.cursorMain);
      hideCursor(sideUI.cursorSample);
    }

    function effectiveCanvas(targetSide) {
      const target = state.sides[targetSide];
      if (!target.source) {
        return null;
      }
      return composeEffectiveCanvas(target.source, target.masks.color, target.masks.local, target.masks.eraser);
    }
  }

  function setupAppEvents() {
    const center = ui.center;
    const app = ui.app;

    app.langSelect.addEventListener("change", () => {
      state.language = app.langSelect.value === LANG.EN ? LANG.EN : LANG.RU;
      applyLanguage();
    });

    center.modeSelect.addEventListener("change", () => {
      state.appMode = center.modeSelect.value;
      if (state.appMode === MODES.MASK) {
        center.brushControls.classList.add("show");
        ensureCenterMaskCanvas();
      } else {
        center.brushControls.classList.remove("show");
        state.center.userMask = null;
        hideCursor(center.cursor);
        state.center.zoom = 1;
        state.center.panX = 0;
        state.center.panY = 0;
      }
      requestLayoutRender();
    });

    center.scaleSelect.addEventListener("change", () => {
      const oldSize = composeCanvasSize();
      state.scalePercent = Number(center.scaleSelect.value);
      const newSize = composeCanvasSize();
      resizeCenterMaskCanvas(oldSize, newSize);
      renderCenterPreview();
    });

    center.tokenScaleSelect.addEventListener("change", () => {
      state.tokenScalePercent = Number(center.tokenScaleSelect.value);
      renderCenterPreview();
    });

    center.brushSizeInput.addEventListener("input", () => {
      state.center.brushSize = Number(center.brushSizeInput.value);
      updateCenterBrushLabel();
      updateCenterCursorFromLast();
    });

    center.wrap.addEventListener("mousedown", onCenterMouseDown);
    window.addEventListener("mousemove", onCenterMouseMove);
    window.addEventListener("mouseup", onCenterMouseUp);
    center.wrap.addEventListener("wheel", onCenterWheel, { passive: false });
    center.wrap.addEventListener("mouseleave", () => {
      if (!state.center.paintingMask) {
        hideCursor(center.cursor);
      }
    });
    center.wrap.addEventListener("contextmenu", (event) => {
      if (state.appMode === MODES.MASK) {
        event.preventDefault();
      }
    });

    window.addEventListener("paste", onWindowPaste);
    center.downloadBtn.addEventListener("click", downloadComposedImage);
    window.addEventListener("resize", renderCenterPreview);
  }

  function setupDropArea(element, onFile) {
    element.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    });

    element.addEventListener("drop", (event) => {
      event.preventDefault();
      const file = event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) {
        onFile(file);
      }
    });
  }

  async function pasteImageTo(target) {
    const image = await readClipboardImage();
    if (!image) {
      state.pendingPasteTarget = target;
      alert(t("alertClipboardPermission"));
      return;
    }

    const canvas = drawableToCanvas(image);
    if (target === SIDE.TOKEN) {
      sideControllers.token.setSource(canvas);
    } else {
      sideControllers.frame.setSource(canvas);
    }
  }

  function onWindowPaste(event) {
    if (!state.pendingPasteTarget) {
      return;
    }

    const data = event.clipboardData;
    if (!data || !data.items) {
      return;
    }

    for (const item of data.items) {
      if (!item.type.startsWith("image/")) {
        continue;
      }

      const blob = item.getAsFile();
      if (!blob) {
        continue;
      }

      fileToImage(blob).then((img) => {
        if (!img) {
          alert(t("alertPastedUnreadable"));
          return;
        }

        const canvas = drawableToCanvas(img);
        if (state.pendingPasteTarget === SIDE.TOKEN) {
          sideControllers.token.setSource(canvas);
        } else {
          sideControllers.frame.setSource(canvas);
        }
        state.pendingPasteTarget = null;
      });

      event.preventDefault();
      return;
    }

    alert(t("alertClipboardNoImage"));
  }

  function onCenterMouseDown(event) {
    if (!state.center.composed) {
      return;
    }

    const point = toPoint(ui.center.wrap, event.clientX, event.clientY);
    state.center.lastMouseX = point.x;
    state.center.lastMouseY = point.y;

    if (!pointInRect(state.center.displayRect, point.x, point.y)) {
      return;
    }

    if (state.appMode === MODES.MASK) {
      if (event.button !== 0 && event.button !== 2) {
        return;
      }
      state.center.paintingMask = true;
      state.center.erasingMask = event.button === 2;
      const imagePoint = widgetToImagePoint(
        state.center.displayRect,
        { width: state.center.composed.width, height: state.center.composed.height },
        point.x,
        point.y
      );
      state.center.lastPaintX = imagePoint.x;
      state.center.lastPaintY = imagePoint.y;
      applyCenterMaskStroke(imagePoint.x, imagePoint.y, imagePoint.x, imagePoint.y, state.center.erasingMask);
      updateCenterCursor(point.x, point.y);
      event.preventDefault();
      return;
    }

    state.center.draggingOffset = true;
  }

  function onCenterMouseMove(event) {
    const point = toPoint(ui.center.wrap, event.clientX, event.clientY);

    if (state.appMode === MODES.MASK) {
      state.center.lastMouseX = point.x;
      state.center.lastMouseY = point.y;
      updateCenterCursor(point.x, point.y);

      if (!state.center.paintingMask) {
        return;
      }

      const imagePoint = widgetToImagePoint(
        state.center.displayRect,
        { width: state.center.composed.width, height: state.center.composed.height },
        point.x,
        point.y
      );

      if (imagePoint.x === state.center.lastPaintX && imagePoint.y === state.center.lastPaintY) {
        return;
      }

      applyCenterMaskStroke(
        state.center.lastPaintX,
        state.center.lastPaintY,
        imagePoint.x,
        imagePoint.y,
        state.center.erasingMask
      );

      state.center.lastPaintX = imagePoint.x;
      state.center.lastPaintY = imagePoint.y;
      return;
    }

    if (!state.center.draggingOffset || state.center.displayScale <= 0 || !state.sides.frame.source) {
      return;
    }

    const dx = point.x - state.center.lastMouseX;
    const dy = point.y - state.center.lastMouseY;
    state.center.lastMouseX = point.x;
    state.center.lastMouseY = point.y;

    state.center.baseOffsetX += Math.round(dx / state.center.displayScale);
    state.center.baseOffsetY += Math.round(dy / state.center.displayScale);
    renderCenterPreview();
  }

  function onCenterMouseUp() {
    state.center.draggingOffset = false;
    state.center.paintingMask = false;
    state.center.erasingMask = false;
  }

  function onCenterWheel(event) {
    if (state.appMode !== MODES.MASK || !state.center.composed) {
      return;
    }

    event.preventDefault();
    const point = toPoint(ui.center.wrap, event.clientX, event.clientY);
    const { width, height } = elementSize(ui.center.wrap);
    const fit = fitRect(state.center.composed.width, state.center.composed.height, width - 28, height - 28);

    const oldZoom = state.center.zoom;
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = clamp(oldZoom * zoomFactor, 1, 8);

    if (Math.abs(newZoom - oldZoom) < 0.0001) {
      if (newZoom <= 1.0001 && (state.center.panX !== 0 || state.center.panY !== 0)) {
        state.center.zoom = 1;
        state.center.panX = 0;
        state.center.panY = 0;
        renderCenterPreview();
      }
      return;
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const oldDrawW = fit.w * oldZoom;
    const oldDrawH = fit.h * oldZoom;
    const oldX = centerX - oldDrawW / 2 + state.center.panX;
    const oldY = centerY - oldDrawH / 2 + state.center.panY;
    const u = (point.x - oldX) / oldDrawW;
    const v = (point.y - oldY) / oldDrawH;
    const newDrawW = fit.w * newZoom;
    const newDrawH = fit.h * newZoom;
    const centeredX = centerX - newDrawW / 2;
    const centeredY = centerY - newDrawH / 2;

    if (newZoom <= 1.0001) {
      state.center.zoom = 1;
      state.center.panX = 0;
      state.center.panY = 0;
    } else {
      state.center.panX = point.x - centeredX - u * newDrawW;
      state.center.panY = point.y - centeredY - v * newDrawH;
      state.center.zoom = newZoom;
    }

    renderCenterPreview();
  }

  function applyCenterMaskStroke(x1, y1, x2, y2, erase) {
    if (state.appMode !== MODES.MASK || !state.sides.token.source) {
      return;
    }

    ensureCenterMaskCanvas();
    if (!state.center.userMask) {
      return;
    }

    const ctx = state.center.userMask.getContext("2d");
    ctx.strokeStyle = "rgba(255,255,255,1)";
    ctx.lineWidth = state.center.brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";

    renderCenterPreview();
  }

  function renderCenterPreview() {
    const ctx = ui.center.canvas.getContext("2d");
    const { width, height } = elementSize(ui.center.wrap);

    if (ui.center.canvas.width !== width || ui.center.canvas.height !== height) {
      ui.center.canvas.width = width;
      ui.center.canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    const composed = composeFinalImage();
    state.center.composed = composed;

    if (!composed) {
      state.center.displayRect = null;
      state.center.displayScale = 1;
      ui.center.placeholder.style.display = "grid";
      ui.center.downloadBtn.disabled = true;
      hideCursor(ui.center.cursor);
      return;
    }

    const fit = fitRect(composed.width, composed.height, width - 28, height - 28);
    const drawW = Math.max(1, Math.floor(fit.w * state.center.zoom));
    const drawH = Math.max(1, Math.floor(fit.h * state.center.zoom));
    const drawX = Math.floor((width - drawW) / 2 + state.center.panX);
    const drawY = Math.floor((height - drawH) / 2 + state.center.panY);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(composed, drawX, drawY, drawW, drawH);

    state.center.displayRect = { x: drawX, y: drawY, w: drawW, h: drawH };
    state.center.displayScale = drawW / composed.width;

    ui.center.placeholder.style.display = "none";
    ui.center.downloadBtn.disabled = false;
  }

  function composeFinalImage() {
    const tokenEffective = composeEffectiveCanvas(
      state.sides.token.source,
      state.sides.token.masks.color,
      state.sides.token.masks.local,
      state.sides.token.masks.eraser
    );

    if (!tokenEffective) {
      return null;
    }

    const frameEffective = composeEffectiveCanvas(
      state.sides.frame.source,
      state.sides.frame.masks.color,
      state.sides.frame.masks.local,
      state.sides.frame.masks.eraser
    );

    const canvasSize = composeCanvasSize();
    const out = createCanvas(canvasSize.width, canvasSize.height);
    const outCtx = out.getContext("2d");

    const frameSize = frameEffective
      ? { width: frameEffective.width, height: frameEffective.height }
      : canvasSize;

    const frameOffset = {
      x: Math.floor((canvasSize.width - frameSize.width) / 2),
      y: Math.floor((canvasSize.height - frameSize.height) / 2),
    };

    const tokenPlacement = computeTokenPlacement(tokenEffective, canvasSize, frameSize, frameOffset);

    if (!frameEffective) {
      outCtx.drawImage(
        tokenPlacement.image,
        tokenPlacement.x,
        tokenPlacement.y,
        tokenPlacement.w,
        tokenPlacement.h
      );
      return out;
    }

    const maskedBase = createCanvas(canvasSize.width, canvasSize.height);
    const mbCtx = maskedBase.getContext("2d");
    mbCtx.drawImage(
      tokenPlacement.image,
      tokenPlacement.x,
      tokenPlacement.y,
      tokenPlacement.w,
      tokenPlacement.h
    );

    mbCtx.globalCompositeOperation = "destination-in";
    if (state.sides.frame.assets.windowMask) {
      mbCtx.drawImage(state.sides.frame.assets.windowMask, frameOffset.x, frameOffset.y);
    } else {
      mbCtx.drawImage(frameEffective, frameOffset.x, frameOffset.y);
    }

    const frameBoundsMask = createCanvas(canvasSize.width, canvasSize.height);
    const boundsCtx = frameBoundsMask.getContext("2d");
    boundsCtx.fillStyle = "rgba(255,255,255,1)";
    boundsCtx.fillRect(frameOffset.x, frameOffset.y, frameSize.width, frameSize.height);
    mbCtx.drawImage(frameBoundsMask, 0, 0);
    mbCtx.globalCompositeOperation = "source-over";

    outCtx.drawImage(maskedBase, 0, 0);

    if (state.sides.frame.assets.overlay) {
      outCtx.drawImage(state.sides.frame.assets.overlay, frameOffset.x, frameOffset.y);
    } else {
      outCtx.drawImage(frameEffective, frameOffset.x, frameOffset.y);
    }

    if (state.appMode === MODES.MASK && state.center.userMask) {
      const topLayer = createCanvas(canvasSize.width, canvasSize.height);
      const topCtx = topLayer.getContext("2d");
      topCtx.drawImage(
        tokenPlacement.image,
        tokenPlacement.x,
        tokenPlacement.y,
        tokenPlacement.w,
        tokenPlacement.h
      );
      topCtx.globalCompositeOperation = "destination-in";
      topCtx.drawImage(state.center.userMask, 0, 0);
      topCtx.globalCompositeOperation = "source-over";
      outCtx.drawImage(topLayer, 0, 0);
    }

    return out;
  }

  function computeTokenPlacement(tokenCanvas, canvasSize, frameSize, frameOffset) {
    const baseScale = Math.max(frameSize.width / tokenCanvas.width, frameSize.height / tokenCanvas.height);
    const scale = baseScale * (state.tokenScalePercent / 100);
    const drawW = Math.round(tokenCanvas.width * scale);
    const drawH = Math.round(tokenCanvas.height * scale);
    const x = frameOffset.x + Math.floor((frameSize.width - drawW) / 2) + state.center.baseOffsetX;
    const y = frameOffset.y + Math.floor((frameSize.height - drawH) / 2) + state.center.baseOffsetY;

    return {
      image: tokenCanvas,
      x,
      y,
      w: drawW,
      h: drawH,
    };
  }

  function composeCanvasSize() {
    let reference = null;

    if (state.sides.frame.source) {
      reference = {
        width: state.sides.frame.source.width,
        height: state.sides.frame.source.height,
      };
    } else if (state.sides.token.source) {
      reference = {
        width: state.sides.token.source.width,
        height: state.sides.token.source.height,
      };
    } else {
      return { width: 0, height: 0 };
    }

    const scale = state.scalePercent / 100;
    return {
      width: Math.max(1, Math.floor(reference.width * scale)),
      height: Math.max(1, Math.floor(reference.height * scale)),
    };
  }

  function ensureMasks(sideName) {
    const side = state.sides[sideName];
    if (!side.source) {
      return;
    }

    side.masks.color = ensureMaskCanvas(side.masks.color, side.source.width, side.source.height);
    side.masks.local = ensureMaskCanvas(side.masks.local, side.source.width, side.source.height);
    side.masks.eraser = ensureMaskCanvas(side.masks.eraser, side.source.width, side.source.height);
  }

  function ensureMaskCanvas(maskCanvas, width, height) {
    if (!maskCanvas || maskCanvas.width !== width || maskCanvas.height !== height) {
      return createCanvas(width, height);
    }
    return maskCanvas;
  }

  function ensureCenterMaskCanvas() {
    if (!state.sides.token.source) {
      return;
    }

    const size = composeCanvasSize();
    if (size.width <= 0 || size.height <= 0) {
      return;
    }

    if (
      !state.center.userMask ||
      state.center.userMask.width !== size.width ||
      state.center.userMask.height !== size.height
    ) {
      state.center.userMask = createCanvas(size.width, size.height);
    }
  }

  function resizeCenterMaskCanvas(oldSize, newSize) {
    if (!state.center.userMask) {
      return;
    }

    if (oldSize.width === newSize.width && oldSize.height === newSize.height) {
      return;
    }

    if (newSize.width <= 0 || newSize.height <= 0) {
      state.center.userMask = null;
      return;
    }

    const next = createCanvas(newSize.width, newSize.height);
    const ctx = next.getContext("2d");
    const dx = Math.floor((newSize.width - oldSize.width) / 2);
    const dy = Math.floor((newSize.height - oldSize.height) / 2);
    ctx.drawImage(state.center.userMask, dx, dy);
    state.center.userMask = next;
  }

  function composeEffectiveCanvas(sourceCanvas, colorMaskCanvas, localMaskCanvas, eraserMaskCanvas) {
    if (!sourceCanvas) {
      return null;
    }

    const out = createCanvas(sourceCanvas.width, sourceCanvas.height);
    const ctx = out.getContext("2d");
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.globalCompositeOperation = "destination-out";

    if (colorMaskCanvas) {
      ctx.drawImage(colorMaskCanvas, 0, 0);
    }
    if (localMaskCanvas) {
      ctx.drawImage(localMaskCanvas, 0, 0);
    }
    if (eraserMaskCanvas) {
      ctx.drawImage(eraserMaskCanvas, 0, 0);
    }

    ctx.globalCompositeOperation = "source-over";
    return out;
  }

  function applyEraserMask(maskCanvas, x1, y1, x2, y2, brushSize, restore) {
    if (!maskCanvas) {
      return;
    }

    const ctx = maskCanvas.getContext("2d");
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(255,255,255,1)";
    ctx.globalCompositeOperation = restore ? "destination-out" : "source-over";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  function applyGlobalColorMask(
    sourceCanvas,
    colorMaskCanvas,
    localMaskCanvas,
    eraserMaskCanvas,
    x1,
    y1,
    x2,
    y2,
    brushSize,
    restore
  ) {
    if (!sourceCanvas || !colorMaskCanvas) {
      return;
    }

    const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const sourceImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const sourceData = sourceImageData.data;

    const effective = composeEffectiveCanvas(sourceCanvas, colorMaskCanvas, localMaskCanvas, eraserMaskCanvas);
    const effectiveCtx = effective.getContext("2d", { willReadFrequently: true });
    const effectiveImageData = effectiveCtx.getImageData(0, 0, effective.width, effective.height);
    const effectiveData = effectiveImageData.data;

    const sampleData = restore ? sourceData : effectiveData;
    const sampledColors = new Set();
    collectColorsFromPath(
      sampleData,
      effective.width,
      effective.height,
      x1,
      y1,
      x2,
      y2,
      brushSize / 2,
      sampledColors
    );

    if (sampledColors.size === 0) {
      return;
    }

    const maskCtx = colorMaskCanvas.getContext("2d", { willReadFrequently: true });
    const maskImageData = maskCtx.getImageData(0, 0, effective.width, effective.height);
    const maskData = maskImageData.data;

    for (let i = 0; i < sourceData.length; i += 4) {
      const key = (sourceData[i] << 16) | (sourceData[i + 1] << 8) | sourceData[i + 2];
      if (!sampledColors.has(key)) {
        continue;
      }

      if (restore) {
        maskData[i + 3] = 0;
      } else if (effectiveData[i + 3] !== 0) {
        maskData[i] = 255;
        maskData[i + 1] = 255;
        maskData[i + 2] = 255;
        maskData[i + 3] = 255;
      }
    }

    maskCtx.putImageData(maskImageData, 0, 0);
  }

  function applyLocalColorMask(
    sourceCanvas,
    colorMaskCanvas,
    localMaskCanvas,
    eraserMaskCanvas,
    x1,
    y1,
    x2,
    y2,
    mainBrushSize,
    sampleBrushSize,
    restore
  ) {
    if (!sourceCanvas || !localMaskCanvas) {
      return;
    }

    const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const sourceImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const sourceData = sourceImageData.data;

    const effective = composeEffectiveCanvas(sourceCanvas, colorMaskCanvas, localMaskCanvas, eraserMaskCanvas);
    const effectiveCtx = effective.getContext("2d", { willReadFrequently: true });
    const effectiveImageData = effectiveCtx.getImageData(0, 0, effective.width, effective.height);
    const effectiveData = effectiveImageData.data;

    const sampleData = restore ? sourceData : effectiveData;
    const areaData = restore ? sourceData : effectiveData;

    const maskCtx = localMaskCanvas.getContext("2d", { willReadFrequently: true });
    const maskImageData = maskCtx.getImageData(0, 0, effective.width, effective.height);
    const maskData = maskImageData.data;

    const mainRadius = mainBrushSize / 2;
    const sampleRadius = sampleBrushSize / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.hypot(dx, dy);
    const step = Math.max(1, mainRadius * 0.4);
    const steps = Math.max(1, Math.ceil(distance / step));

    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const cx = x1 + dx * t;
      const cy = y1 + dy * t;

      const sampledColors = new Set();
      collectColorsInCircle(sampleData, effective.width, effective.height, cx, cy, sampleRadius, sampledColors);
      if (sampledColors.size === 0) {
        continue;
      }

      const radius = Math.max(1, Math.floor(mainRadius));
      const left = clamp(Math.floor(cx - radius), 0, effective.width - 1);
      const right = clamp(Math.ceil(cx + radius), 0, effective.width - 1);
      const top = clamp(Math.floor(cy - radius), 0, effective.height - 1);
      const bottom = clamp(Math.ceil(cy + radius), 0, effective.height - 1);
      const rr = mainRadius * mainRadius;

      for (let y = top; y <= bottom; y += 1) {
        for (let x = left; x <= right; x += 1) {
          const ddx = x - cx;
          const ddy = y - cy;
          if (ddx * ddx + ddy * ddy > rr) {
            continue;
          }

          const i = (y * effective.width + x) * 4;
          if (areaData[i + 3] === 0) {
            continue;
          }

          const key = (areaData[i] << 16) | (areaData[i + 1] << 8) | areaData[i + 2];
          if (!sampledColors.has(key)) {
            continue;
          }

          if (restore) {
            maskData[i + 3] = 0;
          } else {
            maskData[i] = 255;
            maskData[i + 1] = 255;
            maskData[i + 2] = 255;
            maskData[i + 3] = 255;
          }
        }
      }
    }

    maskCtx.putImageData(maskImageData, 0, 0);
  }

  function collectColorsFromPath(data, width, height, x1, y1, x2, y2, radius, outSet) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.hypot(dx, dy);
    const step = Math.max(1, radius * 0.4);
    const steps = Math.max(1, Math.ceil(distance / step));

    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const cx = x1 + dx * t;
      const cy = y1 + dy * t;
      collectColorsInCircle(data, width, height, cx, cy, radius, outSet);
    }
  }

  function collectColorsInCircle(data, width, height, cx, cy, radius, outSet) {
    const r = Math.max(1, Math.floor(radius));
    const left = clamp(Math.floor(cx - r), 0, width - 1);
    const right = clamp(Math.ceil(cx + r), 0, width - 1);
    const top = clamp(Math.floor(cy - r), 0, height - 1);
    const bottom = clamp(Math.ceil(cy + r), 0, height - 1);
    const rr = radius * radius;

    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const ddx = x - cx;
        const ddy = y - cy;
        if (ddx * ddx + ddy * ddy > rr) {
          continue;
        }
        const i = (y * width + x) * 4;
        if (data[i + 3] === 0) {
          continue;
        }
        const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        outSet.add(key);
      }
    }
  }

  function buildFrameAssets(frameCanvas) {
    const src = createCanvas(frameCanvas.width, frameCanvas.height);
    const srcCtx = src.getContext("2d", { willReadFrequently: true });
    srcCtx.drawImage(frameCanvas, 0, 0);

    const { width, height } = src;
    const srcData = srcCtx.getImageData(0, 0, width, height).data;
    const passable = new Uint8Array(width * height);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        const r = srcData[i];
        const g = srcData[i + 1];
        const b = srcData[i + 2];
        const a = srcData[i + 3];

        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const lowSaturation = maxC - minC <= 24;
        const bright = maxC >= 210;
        const almostWhite = maxC >= 245 && maxC - minC <= 12;
        passable[y * width + x] = a < 32 || almostWhite || (a < 220 && bright && lowSaturation) ? 1 : 0;
      }
    }

    const seed = findWindowSeed(passable, width, height);
    const inner = new Uint8Array(width * height);

    if (seed) {
      const qx = new Int32Array(width * height);
      const qy = new Int32Array(width * height);
      let head = 0;
      let tail = 0;
      qx[tail] = seed.x;
      qy[tail] = seed.y;
      tail += 1;
      inner[seed.y * width + seed.x] = 1;

      while (head < tail) {
        const px = qx[head];
        const py = qy[head];
        head += 1;

        const neighbors = [
          [px + 1, py],
          [px - 1, py],
          [px, py + 1],
          [px, py - 1],
        ];

        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }
          const idx = ny * width + nx;
          if (inner[idx] || !passable[idx]) {
            continue;
          }
          inner[idx] = 1;
          qx[tail] = nx;
          qy[tail] = ny;
          tail += 1;
        }
      }
    }

    const overlay = createCanvas(width, height);
    const overlayCtx = overlay.getContext("2d");
    overlayCtx.drawImage(src, 0, 0);
    const overlayImage = overlayCtx.getImageData(0, 0, width, height);

    const windowMask = createCanvas(width, height);
    const windowMaskCtx = windowMask.getContext("2d");
    const windowMaskImage = windowMaskCtx.createImageData(width, height);

    for (let i = 0; i < inner.length; i += 1) {
      if (!inner[i]) {
        continue;
      }
      overlayImage.data[i * 4 + 3] = 0;
      windowMaskImage.data[i * 4] = 255;
      windowMaskImage.data[i * 4 + 1] = 255;
      windowMaskImage.data[i * 4 + 2] = 255;
      windowMaskImage.data[i * 4 + 3] = 255;
    }

    overlayCtx.putImageData(overlayImage, 0, 0);
    windowMaskCtx.putImageData(windowMaskImage, 0, 0);

    return { overlay, windowMask };
  }

  function findWindowSeed(passable, width, height) {
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    if (passable[cy * width + cx]) {
      return { x: cx, y: cy };
    }

    const maxRadius = Math.max(width, height);
    for (let r = 1; r < maxRadius; r += 1) {
      const left = Math.max(cx - r, 0);
      const right = Math.min(cx + r, width - 1);
      const top = Math.max(cy - r, 0);
      const bottom = Math.min(cy + r, height - 1);

      for (let x = left; x <= right; x += 1) {
        if (passable[top * width + x]) {
          return { x, y: top };
        }
        if (passable[bottom * width + x]) {
          return { x, y: bottom };
        }
      }

      for (let y = top; y <= bottom; y += 1) {
        if (passable[y * width + left]) {
          return { x: left, y };
        }
        if (passable[y * width + right]) {
          return { x: right, y };
        }
      }
    }

    return null;
  }

  async function readImageFile(file) {
    if (!file.type.startsWith("image/")) {
      return null;
    }
    return fileToImage(file);
  }

  async function readClipboardImage() {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const type = item.types.find((entry) => entry.startsWith("image/"));
          if (!type) {
            continue;
          }
          const blob = await item.getType(type);
          return fileToImage(blob);
        }
      }
    } catch (_) {
      // noop
    }

    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = (await navigator.clipboard.readText()).trim();
        if (text.startsWith("data:image/")) {
          return srcToImage(text);
        }
      }
    } catch (_) {
      // noop
    }

    return null;
  }

  function fileToImage(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      image.src = url;
    });
  }

  function srcToImage(src) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }

  function downloadComposedImage() {
    if (!state.center.composed) {
      return;
    }

    state.center.composed.toBlob((blob) => {
      if (!blob) {
        alert(t("alertSaveFailed"));
        return;
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "mixed_image.png";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function updateCenterCursorFromLast() {
    const { width, height } = elementSize(ui.center.wrap);
    const x = state.center.lastMouseX || width / 2;
    const y = state.center.lastMouseY || height / 2;
    updateCenterCursor(x, y);
  }

  function updateCenterCursor(x, y) {
    if (state.appMode !== MODES.MASK || !state.center.displayRect) {
      hideCursor(ui.center.cursor);
      return;
    }

    if (!pointInRect(state.center.displayRect, x, y)) {
      hideCursor(ui.center.cursor);
      return;
    }

    const diameter = Math.max(6, Math.round(state.center.brushSize * state.center.displayScale));
    placeCursor(ui.center.cursor, x, y, diameter, "rgba(160, 80, 255, 0.9)", "rgba(160, 80, 255, 0.35)");
  }

  function placeCursor(node, x, y, diameter, borderColor, fillColor) {
    node.style.width = `${diameter}px`;
    node.style.height = `${diameter}px`;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.borderColor = borderColor;
    node.style.background = fillColor;
    node.style.display = "block";
  }

  function hideCursor(node) {
    node.style.display = "none";
  }

  function toPoint(container, clientX, clientY) {
    const rect = container.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function elementSize(node) {
    const rect = node.getBoundingClientRect();
    return {
      width: Math.max(1, Math.floor(rect.width)),
      height: Math.max(1, Math.floor(rect.height)),
    };
  }

  function pointInRect(rect, x, y) {
    if (!rect) {
      return false;
    }
    return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
  }

  function widgetToImagePoint(displayRect, imageSize, x, y) {
    if (!displayRect || !imageSize) {
      return { x: 0, y: 0 };
    }

    const localX = clamp(x - displayRect.x, 0, displayRect.w - 1);
    const localY = clamp(y - displayRect.y, 0, displayRect.h - 1);
    const imgX = Math.floor((localX * imageSize.width) / displayRect.w);
    const imgY = Math.floor((localY * imageSize.height) / displayRect.h);

    return {
      x: clamp(imgX, 0, imageSize.width - 1),
      y: clamp(imgY, 0, imageSize.height - 1),
    };
  }

  function fitRect(srcW, srcH, maxW, maxH) {
    if (srcW <= 0 || srcH <= 0 || maxW <= 0 || maxH <= 0) {
      return { w: 1, h: 1 };
    }
    const scale = Math.min(maxW / srcW, maxH / srcH);
    return {
      w: Math.max(1, Math.floor(srcW * scale)),
      h: Math.max(1, Math.floor(srcH * scale)),
    };
  }

  function createCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function drawableToCanvas(drawable) {
    const width = drawable.naturalWidth ?? drawable.width;
    const height = drawable.naturalHeight ?? drawable.height;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(drawable, 0, 0);
    return canvas;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function renderAll() {
    sideControllers.token.renderPreview();
    sideControllers.frame.renderPreview();
    sideControllers.frame.rebuildAssets();
    renderCenterPreview();
  }

  function requestLayoutRender() {
    if (layoutRenderScheduled) {
      return;
    }
    layoutRenderScheduled = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        layoutRenderScheduled = false;
        renderAll();
      });
    });
  }

  function t(key, vars) {
    const dictionary = I18N[state.language] || I18N[LANG.RU];
    const template = dictionary[key] ?? I18N[LANG.RU][key] ?? key;
    if (!vars) {
      return template;
    }
    return template.replace(/\{(\w+)\}/g, (_, name) => (vars[name] ?? `{${name}}`));
  }

  function applyLanguage() {
    document.documentElement.lang = state.language;
    document.title = t("title");

    const app = ui.app;
    app.title.textContent = t("title");
    app.langSelect.value = state.language;
    app.pasteTokenBtn.textContent = t("paste");
    app.undoTokenBtn.textContent = t("undo");
    app.removeTokenLabel.textContent = t("removeToken");
    app.tokenModeColorLabel.textContent = t("modeColor");
    app.tokenModeLocalLabel.textContent = t("modeLocal");
    app.tokenModeEraserLabel.textContent = t("modeEraser");
    app.tokenDropPlaceholder.textContent = t("placeholderToken");
    app.pasteFrameBtn.textContent = t("paste");
    app.undoFrameBtn.textContent = t("undo");
    app.removeFrameLabel.textContent = t("removeFrame");
    app.frameModeColorLabel.textContent = t("modeColor");
    app.frameModeLocalLabel.textContent = t("modeLocal");
    app.frameModeEraserLabel.textContent = t("modeEraser");
    app.frameDropPlaceholder.textContent = t("placeholderFrame");
    app.previewPlaceholder.textContent = t("placeholderPreview");

    ui.center.downloadBtn.textContent = t("download");
    ui.center.modeSelect.setAttribute("aria-label", t("centerModeLabel"));
    ui.center.scaleSelect.setAttribute("aria-label", t("centerScaleLabel"));
    ui.center.tokenScaleSelect.setAttribute("aria-label", t("centerTokenScaleLabel"));

    const offsetOption = ui.center.modeSelect.querySelector('option[value="offset"]');
    const maskOption = ui.center.modeSelect.querySelector('option[value="mask"]');
    if (offsetOption) {
      offsetOption.textContent = t("modeOffset");
    }
    if (maskOption) {
      maskOption.textContent = t("modeMask");
    }

    updateTokenScaleOptionLabels();
    applyTooltips();
    updateSideBrushLabels(SIDE.TOKEN);
    updateSideBrushLabels(SIDE.FRAME);
    updateCenterBrushLabel();
  }

  function updateTokenScaleOptionLabels() {
    const options = ui.center.tokenScaleSelect.options;
    for (const option of options) {
      option.textContent = `${t("tokenScalePrefix")} ${option.value}%`;
    }
  }

  function updateSideBrushLabels(sideName) {
    const sideState = state.sides[sideName];
    const sideUI = ui[sideName];
    sideUI.brushLabel.textContent = t("brushPurple", { size: sideState.brushSize });
    sideUI.localBrushLabel.textContent = t("brushRed", { size: sideState.localBrushSize });
  }

  function updateCenterBrushLabel() {
    ui.center.brushLabel.textContent = t("brushMain", { size: state.center.brushSize });
  }

  function applyTooltips() {
    const app = ui.app;
    const center = ui.center;

    app.langSelect.title = t("tipLangSelect");
    app.pasteTokenBtn.title = t("tipPasteToken");
    app.undoTokenBtn.title = t("tipUndoToken");
    ui.token.removeCheck.title = t("tipRemoveTokenCheck");
    if (ui.token.removeCheck.closest("label")) {
      ui.token.removeCheck.closest("label").title = t("tipRemoveTokenCheck");
    }
    app.pasteFrameBtn.title = t("tipPasteFrame");
    app.undoFrameBtn.title = t("tipUndoFrame");
    ui.frame.removeCheck.title = t("tipRemoveFrameCheck");
    if (ui.frame.removeCheck.closest("label")) {
      ui.frame.removeCheck.closest("label").title = t("tipRemoveFrameCheck");
    }

    center.modeSelect.title = t("tipCenterMode");
    center.scaleSelect.title = t("tipCenterScale");
    center.tokenScaleSelect.title = t("tipTokenScale");
    center.downloadBtn.title = t("tipDownload");

    ui.token.modeInputs.forEach((input) => {
      if (input.value === BRUSH_MODES.COLOR) {
        input.title = t("tipTokenModeColor");
      } else if (input.value === BRUSH_MODES.LOCAL) {
        input.title = t("tipTokenModeLocal");
      } else if (input.value === BRUSH_MODES.ERASER) {
        input.title = t("tipTokenModeEraser");
      }
      if (input.closest("label")) {
        input.closest("label").title = input.title;
      }
    });

    ui.frame.modeInputs.forEach((input) => {
      if (input.value === BRUSH_MODES.COLOR) {
        input.title = t("tipFrameModeColor");
      } else if (input.value === BRUSH_MODES.LOCAL) {
        input.title = t("tipFrameModeLocal");
      } else if (input.value === BRUSH_MODES.ERASER) {
        input.title = t("tipFrameModeEraser");
      }
      if (input.closest("label")) {
        input.closest("label").title = input.title;
      }
    });
  }
})();
