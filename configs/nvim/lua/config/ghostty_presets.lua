local M = {}

local ghostty_config = vim.fn.expand("~/.config/ghostty/config")

local presets = {
  default = {
    label = "Default",
    font_size = 15.5,
    adjust_cell_height = "6%",
    adjust_cell_width = "2%",
    padding_x = 14,
    padding_y = 14,
  },
  cozy = {
    label = "Cozy",
    font_size = 16,
    adjust_cell_height = "10%",
    adjust_cell_width = "4%",
    padding_x = 18,
    padding_y = 18,
  },
  dense = {
    label = "Dense",
    font_size = 14,
    adjust_cell_height = "2%",
    adjust_cell_width = "0%",
    padding_x = 8,
    padding_y = 8,
  },
  presentation = {
    label = "Presentation",
    font_size = 20,
    adjust_cell_height = "12%",
    adjust_cell_width = "4%",
    padding_x = 24,
    padding_y = 24,
  },
}

local keys = vim.fn.sort(vim.fn.keys(presets))

function M.apply_preset(name)
  local preset = presets[name]
  if not preset then
    vim.notify("Unknown preset: " .. name, vim.log.levels.ERROR)
    return
  end

  local lines = vim.fn.readfile(ghostty_config)
  local new_lines = {}
  local replaced = {
    font_size = false,
    adjust_cell_height = false,
    adjust_cell_width = false,
    padding_x = false,
    padding_y = false,
  }

  for _, line in ipairs(lines) do
    if line:match("^font%-size%s*=") then
      table.insert(new_lines, "font-size = " .. preset.font_size)
      replaced.font_size = true
    elseif line:match("^adjust%-cell%-height%s*=") then
      table.insert(new_lines, "adjust-cell-height = " .. preset.adjust_cell_height)
      replaced.adjust_cell_height = true
    elseif line:match("^adjust%-cell%-width%s*=") then
      table.insert(new_lines, "adjust-cell-width = " .. preset.adjust_cell_width)
      replaced.adjust_cell_width = true
    elseif line:match("^window%-padding%-x%s*=") then
      table.insert(new_lines, "window-padding-x = " .. preset.padding_x)
      replaced.padding_x = true
    elseif line:match("^window%-padding%-y%s*=") then
      table.insert(new_lines, "window-padding-y = " .. preset.padding_y)
      replaced.padding_y = true
    else
      table.insert(new_lines, line)
    end
  end

  if not replaced.font_size then
    table.insert(new_lines, "font-size = " .. preset.font_size)
  end
  if not replaced.adjust_cell_height then
    table.insert(new_lines, "adjust-cell-height = " .. preset.adjust_cell_height)
  end
  if not replaced.adjust_cell_width then
    table.insert(new_lines, "adjust-cell-width = " .. preset.adjust_cell_width)
  end
  if not replaced.padding_x then
    table.insert(new_lines, "window-padding-x = " .. preset.padding_x)
  end
  if not replaced.padding_y then
    table.insert(new_lines, "window-padding-y = " .. preset.padding_y)
  end

  vim.fn.writefile(new_lines, ghostty_config)
  vim.notify("Ghostty: applied preset '" .. preset.label .. "'", vim.log.levels.INFO)
end

function M.pick()
  local items = vim.tbl_map(function(name)
    local p = presets[name]
    return { name = name, display = p.label, preset = p }
  end, keys)

  vim.ui.select(items, {
    prompt = "Ghostty typography presets",
    format_func = function(item)
      local p = item.preset
      return string.format(
        "%-12s  %s pt  cell: %s/%s  pad: %d/%d",
        p.label, p.font_size, p.adjust_cell_height, p.adjust_cell_width, p.padding_x, p.padding_y
      )
    end,
  }, function(choice)
    if choice then
      M.apply_preset(choice.name)
    end
  end)
end

return M
