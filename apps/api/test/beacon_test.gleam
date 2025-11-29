import gleeunit
import gleeunit/should

pub fn main() {
  gleeunit.main()
}

// Placeholder - tests will be added as we build out functionality
pub fn sanity_test() {
  1 + 1
  |> should.equal(2)
}
