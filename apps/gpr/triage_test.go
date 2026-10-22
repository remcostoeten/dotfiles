package main

import "testing"

func TestParseTriageUsesLastBlock(t *testing.T) {
	answer := "plan\n```gpr-triage\n{\"tickets\":[{\"number\":1}]}\n```\nupdated\n```gpr-triage\n{\"tickets\":[{\"number\":3,\"labels\":[\"bug\"],\"comment\":\"hi\"}]}\n```\n"
	got := parseTriage(answer)
	if len(got) != 1 || got[0].Number != 3 || got[0].Comment != "hi" {
		t.Fatalf("unexpected triage: %+v", got)
	}
	if stripTriage(answer) != "plan\n\nupdated" {
		t.Fatalf("unexpected stripped answer: %q", stripTriage(answer))
	}
}

func TestLatestTriageIgnoresForeignTickets(t *testing.T) {
	thread := &aiThread{Key: "issues:#3,#7", Turns: []aiTurn{
		{Answer: "```gpr-triage\n{\"tickets\":[{\"number\":3},{\"number\":99}]}\n```"},
		{Answer: "no block"},
	}}
	idx, tickets := latestTriage(thread)
	if idx != 0 || len(tickets) != 1 || tickets[0].Number != 3 {
		t.Fatalf("idx=%d tickets=%+v", idx, tickets)
	}
	done := aiTurn{Done: map[string]bool{"comment:3": true}}
	if len(pendingTriage(done, []ticketTriage{{Number: 3, Comment: "x"}}, triageComment)) != 0 {
		t.Fatal("already-posted comment should not be pending")
	}
}

func TestOpencodeParser(t *testing.T) {
	parse := newOpencodeParser()
	evs := parse(`{"type":"tool_use","sessionID":"ses_1","part":{"type":"tool","tool":"bash","state":{"input":{"command":"ls"}}}}`)
	if len(evs) != 2 || evs[0].kind != aiSession || evs[1].text != "bash: ls" {
		t.Fatalf("unexpected events: %+v", evs)
	}
	evs = parse(`{"type":"text","sessionID":"ses_1","part":{"type":"text","text":"hi"}}`)
	if len(evs) != 1 || evs[0].kind != aiMessage || evs[0].text != "hi" {
		t.Fatalf("unexpected events: %+v", evs)
	}
}
