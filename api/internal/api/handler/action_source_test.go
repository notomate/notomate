package handler

import "testing"

func TestParseRepoName(t *testing.T) {
	ok := map[string][2]string{
		"actions/checkout":                      {"actions", "checkout"},
		" actions/checkout ":                    {"actions", "checkout"},
		"github.com/github/codeql-action":       {"github", "codeql-action"},
		"https://github.com/my.org/my_repo.git": {"my.org", "my_repo"},
		"https://github.com/my-org/repo/":       {"my-org", "repo"},
	}
	for in, want := range ok {
		owner, repo, valid := parseRepoName(in)
		if !valid || owner != want[0] || repo != want[1] {
			t.Errorf("parseRepoName(%q) = %q, %q, %v", in, owner, repo, valid)
		}
	}
	for _, in := range []string{"", "checkout", "a/b/c", "../x", "a /b", "https://gitlab.com/a/b"} {
		if _, _, valid := parseRepoName(in); valid {
			t.Errorf("parseRepoName(%q) should be invalid", in)
		}
	}
}

func TestValidGitRef(t *testing.T) {
	for _, ref := range []string{"", "main", "v1", "v1.2.3", "release/2024", "0123456789abcdef0123456789abcdef01234567"} {
		if !validGitRef(ref) {
			t.Errorf("validGitRef(%q) = false", ref)
		}
	}
	for _, ref := range []string{"a b", "../x", "x..y", "/main", "main/", "a?b", "${{ x }}"} {
		if validGitRef(ref) {
			t.Errorf("validGitRef(%q) = true", ref)
		}
	}
}
