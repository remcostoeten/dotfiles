package rgb

import "testing"

func TestParseDevices(t *testing.T) {
	out := `0: ASUS ROG STRIX B550-F
  Type:           Motherboard
  Description:    ASUS Aura Motherboard
1: Corsair Vengeance RGB
  Type:           DRAM
`
	got := ParseDevices(out)
	if len(got) != 2 || got[0].Kind != "Motherboard" || got[1].Index != 1 || got[1].Name != "Corsair Vengeance RGB" {
		t.Errorf("ParseDevices = %+v", got)
	}
}
